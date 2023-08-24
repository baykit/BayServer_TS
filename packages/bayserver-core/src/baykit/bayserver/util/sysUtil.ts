import { cwd } from "process";
import { join } from "path";
import { statSync } from "fs";
import * as fs from "fs";
import * as net from "net";
import * as path from "path";

export class SysUtil {

    public static isAbsolutePath(pathStr: string) : boolean {
        return path.isAbsolute(pathStr)
    }

    public static getAbsolutePath(path: string) : string {
        if(SysUtil.isAbsolutePath(path))
            return path;

        return join(cwd(), path);
    }

    public static isFile(path: string) : boolean {
        try {
            let s = statSync(path);
            return s.isFile();
        }
        catch(e) {
            return false
        }
    }

    public static isDirectory(path: string) : boolean {
        try {
            let s = statSync(path);
            return s.isDirectory();
        }
        catch(e) {
            return false
        }
    }

    public static joinPath(path1: string, path2: string): string {
        return join(path1, path2);
    }

    static exists(path: string): boolean {
        return fs.existsSync(path);
    }

    static getFileSize(path: string): number {
        let stat = fs.statSync(path)
        if(stat == null)
            throw new Error("File not found: " + path)
        return stat.size
    }


    static runOnWindows() {
        return process.platform == 'win32'
    }

    static pid(): number {
        return process.pid
    }

    static supportUnixDomainSocketAddress() {
        return !SysUtil.runOnWindows();
    }

    static openUnixDomainSocketChannel(sktPath: string) {
        return net.createConnection(sktPath)
    }

    static copyDir(srcDir: string, dstDir: string) {
        const files = fs.readdirSync(srcDir)

        if (!fs.existsSync(dstDir)) {
            fs.mkdirSync(dstDir)
        }

        files.forEach(file => {
            const srcFile = path.join(srcDir, file)
            const dstFile = path.join(dstDir, file)

            const stats = fs.statSync(srcFile)
            if (stats.isFile()) {
                fs.copyFileSync(srcFile, dstFile)
            } else if (stats.isDirectory()) {
                this.copyDir(srcFile, dstFile)
            }
        })
    }
}