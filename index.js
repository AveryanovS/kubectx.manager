const { prompt,Select } = require('enquirer');
const fs = require('fs');
const { promisify } = require('util');
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const yaml = require('yaml');

const home = process.env.HOME;
const defaultConfigPath = home + '/.kube/config';
const probablyMergingPath = process.cwd() + '/config';

const start = async () => {

    const select = new Select({
        name: 'action',
        message: 'Select action',
        choices: ['merge', 'delete']
    });

    const action = await select.run();


    const {configPath} = await prompt({
        type: 'input',
        name: 'configPath',
        message: 'Path to current kube config?',
        initial: defaultConfigPath,
    });

    const configFile = await readFile(configPath).catch(() => {
        console.error('Kubeconfig file not found');
        process.exit(1);
    });


    let configObj;
    try {
        configObj = yaml.parse(configFile.toString());
    } catch(err) {
        console.error('Kubeconfig file is corrupted');
        process.exit(1);
    }


    if(action === 'merge') {

        const {mergingPath} = await prompt({
            type: 'input',
            name: 'mergingPath',
            message: 'Path to config to merge?',
            initial: probablyMergingPath,
        });

        const mergingFile = await readFile(mergingPath).catch(() => {
            console.error('Kubeconfig file not found');
            process.exit(1);
        });

        let mergingObj;
        try {
            mergingObj = yaml.parse(mergingFile.toString());
        } catch(err) {
            console.error('Kubeconfig file is corrupted');
            process.exit(1);
        }

        const {newContextName} = await prompt({
            type: 'input',
            name: 'newContextName',
            message: 'Name of new context?',
            required: true,
        });

        const dateValue = new Date().valueOf();
        const newClusterName = `${newContextName}-cluster-${dateValue}`;
        const newUserName = `${newContextName}-user-${dateValue}`;

        configObj.clusters.push({
            cluster: mergingObj.clusters[0].cluster,
            name: newClusterName,
        });
        configObj.users.push({
            user: mergingObj.users[0].user,
            name: newUserName,
        });
        configObj.contexts.push({
            context: {
                cluster:newClusterName,
                user: newUserName
            },
            name: newContextName,
        });

        console.log(`Context ${newContextName} created!`);
    } else if(action === 'delete') {
        const contextNames = configObj.contexts.map(c=>c.name);
        const deleteSelect = new Select({
            name: 'contextToDeleteName',
            message: 'Select context to delete',
            choices: contextNames
        });
        const contextToDeleteName = await deleteSelect.run();
        const deletedContext = configObj.contexts.filter(c=>c.name === contextToDeleteName)[0];
        configObj.clusters = configObj.clusters.filter(c=>c.name !== deletedContext.context.cluster);
        configObj.users = configObj.users.filter(c=>c.name !== deletedContext.context.user);
        configObj.contexts = configObj.contexts.filter(c=>c.name !== contextToDeleteName);
        if(configObj['current-context'] === contextToDeleteName)
            configObj['current-context'] =  configObj.contexts[0].name;

        console.log(`Context ${contextToDeleteName} deleted!`);

    }

    const newConfigYaml = yaml.stringify(configObj);
    // await writeFile(configPath, newConfigYaml);
    console.log('Config file updated!');
};

module.exports = () => {
    start().catch(error => {
        console.error(error);
        process.exit(1);
    });
}
