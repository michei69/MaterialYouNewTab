const fs = require("fs");
const path = require("path");

// Delete existing "build" folder
const buildDir = path.join(__dirname, "..", "build");
if (fs.existsSync(buildDir)) {
    fs.rmdirSync(buildDir, { recursive: true });
}

// Create new "build" folder
fs.mkdirSync(buildDir);

// Copy files into "build" folder
const filesToCopy = [
    "docs",
    "favicon",
    "fonts",
    "images",
    "locales",
    "scripts",
    "svgs",
    "index.html",
    "manifest(firefox).json",
    "privacy-policy.html",
    "style.css",
];

filesToCopy.forEach(file => {
    const sourcePath = path.join(__dirname, "..", file);
    const destPath = path.join(buildDir, file == "manifest(firefox).json" ? "manifest.json" : file);
    fs.cpSync(sourcePath, destPath, { recursive: true });
});