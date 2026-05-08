'use strict';

const readline = require('readline');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirm(question, defaultYes = true) {
  const suffix = defaultYes ? ' [Y/n] ' : ' [y/N] ';
  const a = (await prompt(question + suffix)).toLowerCase();
  if (!a) return defaultYes;
  return a.startsWith('y');
}

module.exports = { prompt, confirm };
