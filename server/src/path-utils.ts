import * as pathFunctions from 'path';
import * as fs from 'fs';
import fileUriToPath = require('file-uri-to-path');

export function readFile(filePath: string) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        return fileContent;
    } catch (error) {
        console.error('Error reading file:', error);
        return null;
    }
}

export function findPath(moduleName: string, filePath: string): string {
    const stdFilePath = STD_LIB_PATH + "/" + moduleName + ".lama";
    if(fs.existsSync(stdFilePath)) {
        return stdFilePath;
    } else {
        return pathFunctions.dirname(filePath) + "/" + moduleName + ".lama";
    }
}

export function ensurePath(path: string) {
	if (path.startsWith("file:")) {
		//Decode for Windows paths like /C%3A/...
		let decoded = decodeURIComponent(fileUriToPath(path));
		if(!decoded.startsWith("\\\\") && decoded.startsWith("\\")) {
			//Windows doesn't seem to like paths like \C:\...
			decoded = decoded.substring(1);
		}
		return decoded;
	} else if(!pathFunctions.isAbsolute(path)) {
		return pathFunctions.resolve(path);
	} else {
		return path;
	}
}

export function findLamaFiles(calledPath: string = STD_LIB_PATH): string[] {
    const lamaFiles:string[] = [];

    function scanDirectory(currentPath: string) {
        const files = fs.readdirSync(currentPath);

        files.forEach(file => {
            const filePath = currentPath + "/" + file;
            const stat = fs.statSync(filePath);

            if (stat.isFile() && file.endsWith('.lama')) {
                lamaFiles.push(filePath);
                // console.log(filePath);
            } else if (stat.isDirectory()) {
                scanDirectory(filePath);
            }
        });
    }

    scanDirectory(calledPath);

    return lamaFiles;
}

export function findInterfaceFiles():string[] {
    return [STD_LIB_PATH + "/Std.i"]
    return ["/home/artem/WorkProjects/test/stdlib/Std.i"]
}

const STD_LIB_PATH = pathFunctions.dirname(pathFunctions.dirname(process.env.LAMAC_PATH ? process.env.LAMAC_PATH : "")) + "/share/Lama";