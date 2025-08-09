const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DIST_FOLDER = path.join(__dirname, '../dist');
const SITE_FOLDER = path.join(__dirname, '../site');
const OUTPUT_ZIP = path.join(DIST_FOLDER, 'site-lambda.zip');

function prepareDistFolder() {
    if (!fs.existsSync(DIST_FOLDER)) {
        fs.mkdirSync(DIST_FOLDER);
    }
}

function createZip() {
    const output = fs.createWriteStream(OUTPUT_ZIP);
    const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
        console.log(`Zip file created: ${OUTPUT_ZIP} (${archive.pointer()} total bytes)`);
    });

    archive.on('error', (err) => {
        throw err;
    });

    archive.pipe(output);

    // Add site folder to the zip
    archive.directory(SITE_FOLDER, false);

    archive.finalize();
}

function main() {
    prepareDistFolder();
    createZip();
}

main();
