// Init
/*
===============================
 Step 1: Update app name
 Step 2: Update shipit config
 Step 3: Update env variables
 Step 4: Update nginx file
===============================
*/
const appName = 'exapmle';
let environment;
let releasePath;

module.exports = (shipit) => {
  // Load shipit tasks
  require('/usr/local/lib/node_modules/shipit-deploy')(shipit);
  require('/usr/local/lib/node_modules/shipit-shared')(shipit);

  environment = shipit.environment;

  //   Shipit configuration
  shipit.initConfig({
    default: {
      deployTo: `/home/ubuntu/${appName}/${environment}`,
      repositoryUrl: 'git@github.com:username/repo.git',
      branch: 'main',
      keepReleases: 3,
      shared: {
        overwrite: true,
        dirs: ['node_modules', 'uploads'],
      },
    },
    dev: {
      servers: 'user@hostname',
      key: 'path/to/key',
    },
  });

  const path = require('path');
  const ecosystemFilePath = path.join(shipit.config.deployTo, 'shared', 'ecosystem.config.js');

  // Our listeners and tasks will go here
  shipit.on('updated', () => {
    releasePath = shipit.releasePath;
    shipit.start('npm-install', 'copy-config');
  });

  shipit.on('published', () => {
    shipit.start('pm2-server');
  });

  shipit.blTask('copy-config', async () => {
    // Creating env and nginx file on server
    const fs = require('fs');

    const ecosystem = `
        module.exports = {
        apps: [
                {
                    name: '${appName}-${environment}',
                    script: '${releasePath}/index.js',
                    cwd: '${releasePath}',
                    watch: true,
                    autorestart: true,
                    restart_delay: 1000,
                    env_dev: ${JSON.stringify(env_dev)},
                }
            ]
        };`;

    fs.writeFileSync('ecosystem.config.js', ecosystem, function (err) {
      if (err) throw err;
      console.log('File created successfully.');
    });

    fs.writeFileSync(`${appName}.conf`, nginx, function (err) {
      if (err) throw err;
      console.log('Nginx file created successfully.');
    });

    await shipit.copyToRemote('ecosystem.config.js', ecosystemFilePath);
    await shipit.copyToRemote(`${appName}.conf`, '/etc/nginx/sites-available/', { rsync: '--rsync-path="sudo rsync"' });
    await shipit.remote(`sudo systemctl restart nginx`);
    fs.unlinkSync('ecosystem.config.js');
    fs.unlinkSync(`${appName}.conf`);
  });

  shipit.blTask('npm-install', async () => {
    shipit.remote(`cd ${releasePath} && npm install --production`);
  });

  shipit.blTask('pm2-server', async () => {
    await shipit.remote(`pm2 delete -s ${appName} || :`);
    await shipit.remote(`pm2 start ${ecosystemFilePath} --env ${environment} --watch true`);
  });

  shipit.on('rollback', () => {
    shipit.start('npm-install', 'copy-config');
  });
};

///////////////////////////  ENVIRONMENT VARIABLES  ///////////////////////////
const env_dev = {
  APP_NAME: 'Project-Name',
  NODE_ENV: 'development',
  PORT: '5000',
};

///////////////////////////  NGINX CONFIG  ///////////////////////////
const nginx = `
server {
    listen 80;
    listen [::]:80;

    root ${releasePath}/build;
    index index.html index.htm index.nginx-debian.html;

    server_name www.domain.com, domain.com;

    location / {
            try_files $uri /index.html;
    }

}

server {
    listen 80;
    listen [::]:80;
    server_name api.domain.com;

    location /
    {
        proxy_pass http://127.0.0.1:5000;
    }
}
`;
