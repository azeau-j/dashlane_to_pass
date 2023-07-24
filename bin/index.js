#!/usr/bin/env node

import { program } from 'commander';

program
    .argument('<csv-file-path>');

program.parse();

// const options = program.opts();
