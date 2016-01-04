let spawn = require('child_process').spawn;
import path from 'path';
import moment from 'moment';
let argv = require('yargs')
  .usage('Usage: node . -r [repos] -p [paths]')
  .demand(['r'])
  .array(['r', 'p'])
  .default('p', './')
  .describe('r', 'list of repos')
  .describe('p', 'list of paths')
  .example('node . -r https://<token>@github.com:user/repo.git -p ./tests ./src', 'Will count test cases in two directories')
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
    this.clonedRepoPath = path.join(this.rootPath, 'repo');
    this.now = moment(); // Store this so that all repos have same start date
  }

  cloneRepo(repo) {
    return new Promise((resolve, reject) => {
      let cloneRepoBinary = path.join(this.rootPath, 'bin/clone-repo');

      let child = spawn(cloneRepoBinary, [], {
        env: {
          REPO: repo,
          DIRECTORY: this.clonedRepoPath
        }
      });

      this.handleExit(child, resolve, reject, `Failed cloning repo ${repo}`);
    });
  }

  beginIterationOverTime() {
    return new Promise((resolve, reject) => {
      this.previousSHA = '';

      this.countTestCases()
      .then(this.storeTestCount.bind(this, this.now))
      .then(this.iterateOverTime.bind(this, this.now.clone().startOf('month')))
      .catch(resolve)
      .then(resolve);
    });
  }

  iterateOverTime(date) {
    return new Promise((resolve, reject) => {
      this.findSHAForDate(date)
      .then(this.checkoutAtSHA.bind(this))
      .then(this.countTestCases.bind(this))
      .then(this.storeTestCount.bind(this, date))
      .then(this.iterateOverTime.bind(this, date.clone().subtract(1, 'month')))
      .catch(reject);
    });
  }

  findSHAForDate(date) {
    return new Promise((resolve, reject) => {
      let formatedDate = date.format('YYYY-MM-DD HH:mm');
      let args = ['rev-list', '-n', 1, `--before="${formatedDate}"`, 'master'];

      let child = spawn('git', args, {cwd: this.clonedRepoPath});

      let out = '';
      child.stdout.on('data', function (datum) { out += datum; });
      child.stdout.on('end', () => {
        if (out.length > 0) {
          let sha = out.trim();

          // Reject if we found the same sha as before
          if (sha === this.previousSHA) {
            return reject();
          }

          this.previousSHA = sha;
          resolve(sha);
        } else {
          reject();
        }
      });

      let errorMsg = `Failed to find sha ${formatedDate}`;
      this.handleExit(child, () => {}, reject, errorMsg);
    });
  }

  checkoutAtSHA(sha) {
    return new Promise((resolve, reject) => {
      let child = spawn('git', ['checkout', sha], {
        cwd: this.clonedRepoPath
      });
      this.handleExit(child, resolve, reject, `Failed to checkout at commit.`);
    });
  }

  countTestCases() {
    return new Promise((resolve, reject) => {
      let testCounterBinary = path.join(this.rootPath, 'bin/count-test-cases');
      let completedSearches = 0;
      let totalTestCases = 0;
      let handleCompleted = () => {
        completedSearches++;

        if (completedSearches === this.paths.length) {
          resolve(totalTestCases);
        }
      };

      this.paths.forEach((_path) => {
        let directory = path.join(this.rootPath, 'repo', _path);
        let child = spawn(testCounterBinary, [], {env: {DIRECTORY: directory}});

        let out = '';
        child.stdout.on('data', function (datum) { out += datum; });
        child.stdout.on('end', () => {
          totalTestCases += parseInt(out.trim() | 0);
        });

        this.handleExit(child, handleCompleted, reject, 'Failed to count cases.');
      });
    });
  }

  storeTestCount(date, count) {
    return new Promise((resolve, reject) => {
      let key = date.unix();

      if (!this.results[key]) {
        this.results[key] = 0;
      }

      this.results[key] += count;
      resolve();
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

    this.cloneRepo(nextRepo)
    .then(this.beginIterationOverTime.bind(this))
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
