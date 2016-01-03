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
  }

  cloneRepo(repo) {
    return new Promise((resolve, reject) => {
      console.log(repo);
      resolve();
    });
  }

  countTestCases(repo) {
    return new Promise((resolve, reject) => {
      this.results.someDate = this.results.someDate && (this.results.someDate + 1) || 0;
      resolve();
    });
  }

  removeRepo(repo) {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  run() {
    let nextRepo = this.repos.shift();

    if (!nextRepo) {
      return this.complete();
    }

    this.cloneRepo(nextRepo)
    .then(this.countTestCases.bind(this))
    .then(this.removeRepo.bind(this))
    .then(this.run.bind(this));
  }

  complete() {
    console.log(this.results);
  }
}

(new Application(argv.r, argv.p)).run();
