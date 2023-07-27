#!/usr/bin/env node

import { program } from 'commander';
import * as fs from 'fs';
import * as csv from 'csv-parse/sync';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { Separator, confirm, select, input, editor, expand } from '@inquirer/prompts';
import path from 'path';

const passwordPrefix = 'passwords/'

program
    .command('import <csv-file-path>')
    .description('Command to import dashlane CSV into pass')
    .action(importCsvFile);

let checkPassInit = spawnSync('pass');

if (checkPassInit.status == 1) {
    console.log(chalk.redBright("ERROR: pass not initialize. Try 'pass init'"));
    process.exit(1);
}

program.parse();

async function importCsvFile(csvFilePath) {
    console.log(`Import : ${csvFilePath}\n`);

    const fileContent = await fs.promises.readFile(csvFilePath);
    const records = csv.parse(fileContent, { columns: true });

    for (const key in records) {
        if (Object.hasOwnProperty.call(records, key)) {
            const element = records[key];
            element.title = (path.parse(element.title).name);

            console.log(`${parseInt(key) + 1}/${records.length} | Import password for ${element.username} at ${element.title}`);
            await parseRow(element);

            console.clear();
        }
    }
}

async function parseRow(row) {
    let { username, username2, username3, title, password, url } = row;

    const canImport = await confirm({ message: 'Continue?', default: true });

    if (!canImport)
        return;

    let checkPassExist = spawnSync('pass', ["show", `${passwordPrefix}${title}`, '-c']);

    if (checkPassExist.status == 0) {
        if (await confirm({
            message: chalk.redBright("ERROR: pass already exist with this title.\nDo you want to change it ?")
        })) {
            const answer = await input({ message: `Enter new title :`, default: title });

            let checkPassExist = spawnSync('pass', ["show", `${passwordPrefix}${answer}`, '-c']);

            if (checkPassExist.status == 0) {
                if (await confirm({
                    message: chalk.redBright("ERROR: pass already exist with this title.\nDo you want to overwrite ?")
                })) {
                    title = answer;
                }
            } else {
                title = answer;
            }
        }
    }


    if (username2) {
        let choices = [
            {
                name: username,
                value: username,
            },
            {
                name: username2,
                value: username2,
            },
        ];

        if (username3) {
            choices = [
                ...choices,
                {
                    name: username3,
                    value: username3,
                },
            ]
        }

        const chooseUsername = await select({
            message: 'Multiple username detected, which on do you want to use ?',
            choices: choices,
        });

        username = chooseUsername;
    }

    let response = await canSave({ title, username, password, url });

    while (response === 'n') {
        const fieldToModify = await select({
            message: 'What field do you want to modify ?',
            choices: [
                {
                    name: 'Title',
                    value: 'title',
                },
                {
                    name: 'Username',
                    value: 'username',
                },
                {
                    name: 'Url',
                    value: 'url',
                },
            ],
        });

        const currentValue = (() => {
            switch (fieldToModify) {
                case 'title': return title;
                case 'username': return username;
                case 'url': return url;
                default: return 1;
            }
        })();

        const answer = await input({ message: `Enter new value for ${fieldToModify} :`, default: currentValue });

        switch (fieldToModify) {
            case 'title':
                let checkPassExist = spawnSync('pass', ["show", `${passwordPrefix}${answer}`, "-c"]);
                if (checkPassExist.status == 0) {
                    if (!(await confirm({
                        message: chalk.redBright("ERROR: pass already exist with this title.\nDo you want to overwrite ?")
                    }))) {
                        break;
                    }
                }

                title = answer;
                break;
            case 'username':
                username = answer;
                break;
            case 'url':
                url = answer;
                break;
        }

        if (await confirm({ message: "Modify another field ?", default: false })) {
            continue;
        }
        response = await canSave({ title, username, password, url });
    }

    if (response == 'c') {
        return;
    }

    spawnSync('pass', ['insert', `passwords/${title}`, '-m'], {
        input: [
            `${password}`,
            `login: ${username}`,
            `url: ${url}`
        ].join('\n')
    });
}

async function canSave({ title, username, password, url }) {
    console.log(`Data : 
    Title    : ${title}
    Username : ${username}
    Password : ${'*'.repeat(password.length)}
    Url      : ${url}`);

    return await expand({
        message: 'Save this data ?',
        default: 'y',
        choices: [
            {
                key: 'y',
                name: 'Yes',
                value: 'y',
            },
            {
                key: 'n',
                name: 'No',
                value: 'n',
            },
            {
                key: 'c',
                name: 'Continue to next password, without save this one',
                value: 'c',
            },
        ],
    });
}
