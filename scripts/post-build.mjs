import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// Get version and timestamp (Japan time)
const manifest = JSON.parse(fs.readFileSync(path.join(rootDir, 'manifest.json'), 'utf8'));
const version = manifest.version;
const jstDate = new Date(Date.now() + 9 * 60 * 60 * 1000); // JST = UTC+9
const timestamp = jstDate.toISOString().replace(/[T:-]/g, '').replace(/\.\d{3}Z$/, '').replace(/^(\d{8})(\d{6})$/, '$1_$2'); // YYYYMMDD_HHMMSS

const includeLocalVadAssets = process.env.INCLUDE_WASM === 'true' || process.argv.includes('--with-wasm');

// Build output directories
const buildRootDir = path.join(rootDir, 'build');
const buildTimestampDir = path.join(buildRootDir, timestamp);
const buildLatestDir = path.join(buildRootDir, 'latest');

// Create build directories (keep history)
console.log('📁 Preparing build directories...');
fs.mkdirSync(buildTimestampDir, { recursive: true });
// Do NOT clean build/latest here; esbuild writes main.js into build/latest
fs.mkdirSync(buildLatestDir, { recursive: true });

// Function to copy files to a directory
function copyToBuildDir(targetDir, targetName) {
    console.log(`\n📦 Building to ${targetName}...`);
    
    // main.js is now produced by esbuild under build/latest/
    const mainJsSrcPath = path.join(buildLatestDir, 'main.js');
    const filesToCopy = ['manifest.json'];
    
    // Copy main.js when targetDir is not the same as source (timestamped builds)
    const mainJsDestPath = path.join(targetDir, 'main.js');
    if (path.resolve(targetDir) !== path.resolve(buildLatestDir)) {
        if (fs.existsSync(mainJsSrcPath)) {
            fs.copyFileSync(mainJsSrcPath, mainJsDestPath);
            console.log('  ✅ main.js');
        } else {
            console.error('  ❌ main.js not found in build/latest!');
            process.exit(1);
        }
    } else {
        // For build/latest ensure main.js exists
        if (fs.existsSync(mainJsSrcPath)) {
            console.log('  ✅ main.js');
        } else {
            console.error('  ❌ main.js not found in build/latest!');
            process.exit(1);
        }
    }

    // Copy supporting plugin files (from project root)
    filesToCopy.forEach(file => {
        const srcPath = path.join(rootDir, file);
        const destPath = path.join(targetDir, file);
        
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`  ✅ ${file}`);
        } else {
            console.error(`  ❌ ${file} not found!`);
            process.exit(1);
        }
    });
    
    // Copy styles.css from src/styles/voice-input.css
    const stylesSrcPath = path.join(rootDir, 'src', 'styles', 'voice-input.css');
    const stylesDestPath = path.join(targetDir, 'styles.css');
    if (fs.existsSync(stylesSrcPath)) {
        fs.copyFileSync(stylesSrcPath, stylesDestPath);
        console.log(`  ✅ styles.css (from src/styles/voice-input.css)`);
    } else {
        console.log(`  ⚠️  styles.css (optional, not found)`);
    }
    
    const fvadSourceDir = path.join(rootDir, 'src', 'lib', 'fvad-wasm');
    const fvadJsSrcPath = path.join(fvadSourceDir, 'fvad.js');

    if (includeLocalVadAssets) {
        const fvadJsDestPath = path.join(targetDir, 'fvad.js');
        if (fs.existsSync(fvadJsSrcPath)) {
            fs.copyFileSync(fvadJsSrcPath, fvadJsDestPath);
            console.log('  ✅ fvad.js (WebAssembly loader)');
        } else {
            console.warn('  ⚠️  fvad.js not found (local VAD loader will be missing)');
        }

        const fvadWasmSrcPath = path.join(fvadSourceDir, 'fvad.wasm');
        const fvadWasmDestPath = path.join(targetDir, 'fvad.wasm');
        if (fs.existsSync(fvadWasmSrcPath)) {
            fs.copyFileSync(fvadWasmSrcPath, fvadWasmDestPath);
            console.log('  ✅ fvad.wasm (WebAssembly binary)');
        } else {
            console.warn('  ⚠️  fvad.wasm not found (skipped)');
        }
    } else {
        const leftoverFiles = ['fvad.js', 'fvad.wasm'];
        leftoverFiles.forEach(file => {
            const targetPath = path.join(targetDir, file);
            if (fs.existsSync(targetPath)) {
                fs.rmSync(targetPath, { force: true });
                console.log(`  🧹 removed leftover ${file}`);
            }
        });
        console.log('  • Skipping local VAD assets (INCLUDE_WASM not set)');
    }

    // Copy license files (best practice to ship with distribution)
    const licenseFiles = ['LICENSE', 'THIRD_PARTY_LICENSES.md'];
    licenseFiles.forEach((file) => {
        const srcPath = path.join(rootDir, file);
        const destPath = path.join(targetDir, file);
        if (fs.existsSync(srcPath)) {
            fs.copyFileSync(srcPath, destPath);
            console.log(`  ✅ ${file}`);
        } else {
            // Non-fatal if missing
            console.log(`  ⚠️  ${file} (optional, not found)`);
        }
    });
}

// Copy to timestamped directory (for history)
copyToBuildDir(buildTimestampDir, `build/${timestamp}`);

// Ensure latest directory contains non-bundled assets as well
copyToBuildDir(buildLatestDir, 'build/latest');

// Verify build first
const mainJsSize = fs.statSync(path.join(buildTimestampDir, 'main.js')).size;
const mainJsSizeLatest = fs.statSync(path.join(buildLatestDir, 'main.js')).size;

// Create or update build history file
const buildHistoryPath = path.join(buildRootDir, 'build-history.json');
let buildsInfo = [];
if (fs.existsSync(buildHistoryPath)) {
    buildsInfo = JSON.parse(fs.readFileSync(buildHistoryPath, 'utf8'));
}

// Add current build info
buildsInfo.push({
    timestamp: timestamp,
    date: new Date().toISOString(),
    version: version,
    mainJsSize: mainJsSize
});

// Keep only last 20 builds info
if (buildsInfo.length > 20) {
    buildsInfo = buildsInfo.slice(-20);
}

fs.writeFileSync(buildHistoryPath, JSON.stringify(buildsInfo, null, 2));

// Clean up old builds (keep last 10)
const allBuilds = fs.readdirSync(buildRootDir)
    .filter(dir => dir.match(/^\d{8}_\d{6}$/))
    .sort();

if (allBuilds.length > 10) {
    const buildsToRemove = allBuilds.slice(0, -10);
    buildsToRemove.forEach(oldBuild => {
        const oldBuildPath = path.join(buildRootDir, oldBuild);
        console.log(`🗑️  Removing old build: ${oldBuild}`);
        fs.rmSync(oldBuildPath, { recursive: true, force: true });
    });
}

if (mainJsSize < 10000 || mainJsSizeLatest < 10000) {
    console.error('❌ main.js seems too small. Build may have failed.');
    process.exit(1);
}

// Get current build count
const currentBuilds = fs.readdirSync(buildRootDir)
    .filter(dir => dir.match(/^\d{8}_\d{6}$/));

console.log(`\n✨ Build complete!`);
console.log(`📁 Build output:`);
console.log(`   - Timestamped: build/${timestamp}/ (${(mainJsSize / 1024).toFixed(2)} KB)`);
console.log(`   - Latest: build/latest/ (${(mainJsSizeLatest / 1024).toFixed(2)} KB)`);
console.log(`\n📚 Build history: ${currentBuilds.length} builds kept`);
console.log(`\n💡 Tip: Use 'npm run deploy' to deploy to Obsidian vaults`);
