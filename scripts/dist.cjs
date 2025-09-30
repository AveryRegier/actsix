// Helper to copy a package into dist/node_modules, ensuring the target exists
function replaceSymlinkedPackageWithRealFiles(pkgName, sourcePath) {

    const distNodeModules = normalizeWinPath(path.join(DIST_FOLDER, 'node_modules'));
    const targetPath = normalizeWinPath(path.join(distNodeModules, pkgName));
    const parentDir = path.dirname(targetPath);

    console.log('--- DEBUG: Parent Directory State ---');
    if (fs.existsSync(parentDir)) {
        const stat = fs.lstatSync(parentDir);
        console.log('Parent exists. isDirectory:', stat.isDirectory(), 'isSymbolicLink:', stat.isSymbolicLink());
    } else {
        console.log('Parent does not exist!');
    }

    // Try manually creating the target directory
    try {
        fs.mkdirSync(targetPath, { recursive: true });
        console.log('Created target directory:', targetPath);
    } catch (err) {
        console.log('Error creating target directory:', err);
    }
    // Remove existing package dir or symlink if present
    if (fs.existsSync(targetPath)) {
        const stat = fs.lstatSync(targetPath);
        if (stat.isSymbolicLink()) {
            fs.unlinkSync(targetPath);
            console.log(`Removed symlink at ${targetPath}`);
        } else {
            fs.rmSync(targetPath, { recursive: true, force: true });
            console.log(`Removed directory at ${targetPath}`);
        }
    }
    // Debug: Target path state
    console.log('--- DEBUG: Target Path State ---');
    if (fs.existsSync(targetPath)) {
        const stat = fs.lstatSync(targetPath);
        console.log('Target exists. isDirectory:', stat.isDirectory(), 'isSymbolicLink:', stat.isSymbolicLink());
    } else {
        console.log('Target does not exist.');
    }
    // Debug: Source path state and symlinks
    console.log('--- DEBUG: Source Path State ---');
    if (fs.existsSync(sourcePath)) {
        const stat = fs.lstatSync(sourcePath);
        console.log('Source exists. isDirectory:', stat.isDirectory(), 'isSymbolicLink:', stat.isSymbolicLink());
        // List all files and check for symlinks
        const files = fs.readdirSync(sourcePath);
        for (const file of files) {
            const filePath = path.join(sourcePath, file);
            const fileStat = fs.lstatSync(filePath);
            if (fileStat.isSymbolicLink()) {
                console.log('Symlink found in source:', filePath, '->', fs.readlinkSync(filePath));
            }
        }
    } else {
        console.log('Source does not exist!');
    }
    // Copy package
    console.log(`Copying ${pkgName} from:`, sourcePath, 'to', targetPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`${pkgName} source directory not found: ${sourcePath}`);
    }
    try {
        fs.cpSync(sourcePath, targetPath, { recursive: true });
        return targetPath;
    } catch (err) {
        console.log('cpSync failed, trying alternate target directory clox_real:', err);
        const altTarget = targetPath + '_real';
        fs.mkdirSync(altTarget, { recursive: true });
        fs.cpSync(sourcePath, altTarget, { recursive: true });
        return altTarget;
    }
}
// Helper to normalize and strip Windows extended-length path prefix
function normalizeWinPath(p) {
    let np = path.normalize(p);
    const i = np.indexOf("C:");
    np = np.slice(i);
    return np;
}
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


    // Transform package.json before copying to dist
    const pkgPath = path.join(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    // Remove clox and sengo from dependencies
    if (pkg.dependencies) {
        delete pkg.dependencies['clox'];
        delete pkg.dependencies['sengo'];
    }
    // Remove devDependencies and scripts
    delete pkg.devDependencies;
    delete pkg.scripts;
    fs.writeFileSync(path.join(DIST_FOLDER, 'package.json'), JSON.stringify(pkg, null, 2));

    // Install production dependencies in dist (now without clox/sengo)
    console.log('Installing production dependencies in dist...');
    const { execSync } = require('child_process');
    execSync('npm install --omit-dev', { cwd: DIST_FOLDER, stdio: 'inherit' });
    console.log('Production dependencies installed successfully.');

    // Copy real clox and sengo files into dist/node_modules
    const cloxSource = normalizeWinPath(path.join(__dirname, '../../clox/dist'));
    const cloxTarget = replaceSymlinkedPackageWithRealFiles('clox', cloxSource);
    const sengoDistFolder = normalizeWinPath(path.join(SENGO_SOURCE_FOLDER, 'client/dist'));
    const sengoTarget = replaceSymlinkedPackageWithRealFiles('sengo', sengoDistFolder);

    // Install dependencies for clox and sengo in dist/node_modules
    try {
        console.log('Installing clox dependencies...');
        execSync('npm install --omit-dev', { cwd: cloxTarget, stdio: 'inherit' });
        console.log('clox dependencies installed.');
    } catch (err) {
        console.log('Error installing clox dependencies:', err);
    }
    try {
        console.log('Installing sengo dependencies with --legacy-peer-deps...');
        execSync('npm install --legacy-peer-deps --omit-dev', { cwd: sengoTarget, stdio: 'inherit' });
        console.log('sengo dependencies installed.');
    } catch (err) {
        console.log('Error installing sengo dependencies:', err);
    }
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
        ignore: [path.basename(OUTPUT_ZIP)],
        followSymlinks: true
    });

    console.log('Finalizing the zip file...');
    archive.finalize();
}

function main() {
    prepareDistFolder();
    createZip();
}

main();
