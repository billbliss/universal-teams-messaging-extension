# Universal Teams Messaging Extension

This application illustrates how to create a Microsoft Teams messaging extension using a data-driven approach.

TODO: Add more documentation.

## Building the app

The application is built using the `build` Gulp task.

``` bash
npm i -g gulp gulp-cli
gulp build
```

## Building the manifest

To create the Microsoft Teams Apps manifest, run the `manifest` Gulp task. This will generate and validate the package and finally create the package (a zip file) in the `package` folder. The manifest will be validated against the schema and dynamically populated with values from the `.env` file.

``` bash
gulp manifest
```

## Configuration

Configuration is stored in the `.env` file. 

## Debug and test locally

To debug and test the solution locally you use the `serve` Gulp task. This will first build the app and then start a local web server on port 3007, where you can test your Tabs, Bots or other extensions. Also this command will rebuild the App if you change any file in the `/src` directory.

``` bash
gulp serve
```

To debug the code you can append the argument `debug` to the `serve` command as follows. This allows you to step through your code using your preferred code editor.

``` bash
gulp serve --debug
```

Note: if you are using Node 10.0 or later, the syntax is slightly different:

``` bash
gulp serve --inspect
```

To step through code in Visual Studio Code you need to add the following snippet in the `./.vscode/launch.json` file. Once done, you can easily attach to the node process after running the `gulp serve --debug` or `gulp serve --inspect` command.

``` json
{
    "type": "node",
    "request": "attach",
    "name": "Attach",
    "port": 5858,
    "sourceMaps": true,
    "outFiles": [
        "${workspaceRoot}/dist/**/*.js"
    ],
    "remoteRoot": "${workspaceRoot}/src/"
},
```

### Using ngrok for local development and hosting

In order to make development locally a great experience it is recommended to use [ngrok](https://ngrok.io), which allows you to publish the localhost on a public DNS, so that you can consume the bot and the other resources in Microsoft Teams. Start ngrok locally and either specify a reserved hostname or use a dynamic generated one. Modify the `HOSTNAME` property of the `.env` file with the public hostname you have in ngrok, rebuild the manifest and upload it to Microsoft Teams and start `gulp serve`.

## Output

* dist/* - the files required to host the solution
* package/* - the Teams extensibility package (zip file) to be uploaded to Microsoft Teams ([how-to](https://msdn.microsoft.com/en-us/microsoft-teams/createpackage#uploading-your-tab-package-to-microsoft-teams))
* temp - used for temporary processing of files during build time

## Logging

To enable logging for the solution you need to add `msteams` to the `DEBUG` environment variable. See the [debug package](https://www.npmjs.com/package/debug) for more information.

Example for Windows command line:

> SET DEBUG=msteams

If you are using Microsoft Azure to host your Microsoft Teams app, then you can add `DEBUG` as an Application Setting with the value of `msteams`.