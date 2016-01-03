let spawn = require('child_process').spawn;
import path from 'path';
let argv = require('yargs')
  .usage('Usage: node . -r [repos] -p [paths]')
  .demand(['r'])
  .array(['r', 'p'])
  .default('p', './')
  .describe('r', 'comma separated list of repos')
  .describe('p', 'comma separated list of paths')
  .example('node . -r git@github.com:user/repo.git -p ./tests ./src', 'Will count test cases in two directories')
  .wrap(null)
  .help('h')
  .alias('h', 'help')
  .argv;

class Application {
  constructor(repos, paths) {
    this.repos = repos;
    this.paths = paths;
    this.results = {};
    this.rootPath = path.join(__dirname, '../');
  }

  removeClonedRepo(repo) {
    return new Promise((resolve, reject) => {
      let child = spawn('rm', ['-rf', `${path.join(this.rootPath, 'repo')}`]);

      this.handleExit(child, resolve, reject, 'Failed to remove cloned repo');
    });
  }

  cloneRepo(repo) {
    return new Promise((resolve, reject) => {
      let cloneRepoPath = path.join(this.rootPath, 'bin/clone-repo');

      let child = spawn(cloneRepoPath, [], {
        env: {
          REPO: repo,
          DIRECTORY: path.join(this.rootPath, 'repo')
        }
      });

      this.handleExit(child, resolve, reject, `Failed cloning repo ${repo}`);
    });
  }

  countTestCases(repo) {
    return new Promise((resolve, reject) => {
      let testCounterPath = path.join(this.rootPath, 'bin/count-test-cases');
      let completedSearches = 0;
      let handleCompleted = () => {
        completedSearches++;

        if (completedSearches === this.paths.length) {
          resolve();
        }
      };

      this.paths.forEach((_path) => {
        let directory = path.join(this.rootPath, 'repo', _path);
        let child = spawn(testCounterPath, [], {env: {DIRECTORY: directory}});
        let errorMsg = `Failed cloning repo ${repo}`;
        let out = '';

        child.stdout.on('data', function (datum) { out += datum; });

        child.stdout.on('end', () => {
          this.results[(new Date()).getTime()] = out.trim();
        });

        this.handleExit(child, handleCompleted, reject, errorMsg);
      });
    });
  }

  handleExit(childProcess, resolve, reject, errorMsg) {
    childProcess.on('exit', function(code) {
      if (code != 0) {
        reject(errorMsg);
      } else {
        resolve();
      }
    });
  }

  run() {
    let nextRepo = this.repos.shift();

    if (!nextRepo) {
      return this.complete();
    }

    this.removeClonedRepo()
    .then(this.cloneRepo.bind(this, nextRepo))
    .then(this.countTestCases.bind(this))
    .catch(this.onError.bind(this))
    .then(this.run.bind(this));
  }

  onError(error) {
    throw this.results;
  }

  complete() {
    console.log(this.results);
  }
}

(new Application(argv.r, argv.p)).run();
