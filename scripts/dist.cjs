const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DIST_FOLDER = path.join(__dirname, '../dist');
const SITE_FOLDER = path.join(__dirname, '../site');
const LAMBDA_FOLDER = path.join(__dirname, '../src');
const SENGO_SOURCE_FOLDER = path.join(__dirname, '../../sengo');
const OUTPUT_ZIP = path.join(DIST_FOLDER, 'site-lambda.zip');

function prepareDistFolder() {
    if (fs.existsSync(DIST_FOLDER)) {
        fs.rmSync(DIST_FOLDER, { recursive: true, force: true });
    }
    fs.mkdirSync(DIST_FOLDER);

    // Copy site and src folders to dist
    fs.cpSync(SITE_FOLDER, path.join(DIST_FOLDER, 'site'), { recursive: true });
    fs.cpSync(LAMBDA_FOLDER, path.join(DIST_FOLDER, 'src'), { recursive: true });

    // Copy package.json to dist
    fs.cpSync(path.join(__dirname, '../package.json'), path.join(DIST_FOLDER, 'package.json'));

    // Install production dependencies in dist
    console.log('Installing production dependencies in dist...');
    const { execSync } = require('child_process');
    execSync('npm install --omit-dev', { cwd: DIST_FOLDER, stdio: 'inherit' });
    console.log('Production dependencies installed successfully. Proceeding to copy Sengo...');

    // Copy Sengo source files directly to dist/node_modules
    const sengoDistFolder = path.join(SENGO_SOURCE_FOLDER, 'client/dist');
    fs.mkdirSync(path.join(DIST_FOLDER, 'node_modules/sengo'), { recursive: true });
    fs.cpSync(sengoDistFolder, path.join(DIST_FOLDER, 'node_modules/sengo'), { recursive: true });

    // Install production dependencies for Sengo
    console.log('Installing production dependencies for Sengo...');
    execSync('npm install --omit-dev', { cwd: path.join(DIST_FOLDER, 'node_modules/sengo'), stdio: 'inherit' });
    console.log('Production dependencies for Sengo installed successfully.');
}

function createZip() {
    const output = fs.createWriteStream(OUTPUT_ZIP);
    const archive = archiver('zip', {
        zlib: { level: 6 } // Balanced compression for speed and size
    });

    output.on('close', () => {
        console.log(`Zip file created: ${OUTPUT_ZIP} (${archive.pointer()} total bytes)`);
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    console.log('Starting to create zip file...');

    // archive.on('progress', (data) => {
    //     console.log(`Progress: ${data.entries.processed} entries processed, ${data.fs.processedBytes} bytes written.`);
    // });

    console.log('Adding dist folder to the zip, excluding the zip file itself...');
    archive.glob('**/*', {
        cwd: DIST_FOLDER,
        ignore: [path.basename(OUTPUT_ZIP)]
    });

    console.log('Finalizing the zip file...');
    archive.finalize();
}

function main() {
    prepareDistFolder();
    createZip();
}

main();
