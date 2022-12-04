const packager = require("electron-packager");
const { rebuild } = require("electron-rebuild");
const path = require("path");

const basePath = path.resolve(__dirname, "..");
const rebuildModules = ["node-pty"];

packager({
    dir: basePath,

    ignore: /^\/(_sb|.parcel-cache|res|renderer-dev|src|dist\/renderer-dev)/,

    icon: path.join(basePath, "res", "icon.icns"),

    arch: ["x64", "arm64"],

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
