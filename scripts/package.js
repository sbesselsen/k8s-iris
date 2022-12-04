const packager = require("electron-packager");
const { rebuild } = require("electron-rebuild");
const { makeUniversalApp } = require("@electron/universal");
const fs = require("fs");
const rimraf = require("rimraf");
const path = require("path");
const { promisify } = require("util");

const basePath = path.resolve(__dirname, "..");
const rebuildModules = ["node-pty"];
const ignore = /^\/(_sb|.parcel-cache|res|renderer-dev|src|dist\/renderer-dev)/;
const icon = path.join(basePath, "res", "icon.icns");
const archs = ["x64", "arm64"];

const rmrf = promisify(rimraf);

(async () => {
    for (const arch of archs) {
        console.group(`Building for ${arch}`);
        await packager({
            dir: basePath,
            ignore,
            icon,
            arch,
            afterCopy: [
                (buildPath, electronVersion, _platform, arch, callback) => {
                    rebuild({
                        buildPath,
                        electronVersion,
                        arch,
                        force: true,
                        onlyModules: rebuildModules,
                    })
                        .then(() => callback())
                        .catch((error) => callback(error));
                },
            ],
        });

        // Delete offending node-pty files that will cause trouble in the universal build.
        // ("While trying to merge mach-o files across your apps we found a mismatch.")
        // None of this is great but I want it to work before introducing new build tools.
        console.log("Removing node-pty files that break universal build");
        const nodePtyDir = path.join(
            basePath,
            `Iris-darwin-${arch}`,
            "Iris.app",
            "Contents",
            "Resources",
            "app",
            "node_modules",
            "node-pty"
        );
        await rmrf(path.join(nodePtyDir, "bin"));
        await rmrf(path.join(nodePtyDir, "build", "Makefile"));
        await rmrf(path.join(nodePtyDir, "build", "Release", ".deps"));
        await rmrf(path.join(nodePtyDir, "build", "Release", ".forge-meta"));
        await rmrf(path.join(nodePtyDir, "build", "Release", "obj.target"));
        await rmrf(path.join(nodePtyDir, "build", "config.gypi"));
        await rmrf(path.join(nodePtyDir, "build", "pty.target.mk"));

        console.groupEnd();
    }

    console.group(`Creating universal binary`);
    await makeUniversalApp({
        x64AppPath: path.join(basePath, "Iris-darwin-x64", "Iris.app"),
        arm64AppPath: path.join(basePath, "Iris-darwin-arm64", "Iris.app"),
        outAppPath: path.join(basePath, "Iris-darwin-universal", "Iris.app"),
    });
})();
