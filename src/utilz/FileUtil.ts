import {promises as fs} from "fs";
import path from "path";

// thin wrapper, easier to remember node11+ async api
// also double checks for success calls
// only async apis (!)
export class FileUtil {

  public static async readFileUtf8(path: string): Promise<string> {
    return await fs.readFile(path, { encoding: 'utf8', flag: 'r' }); // note: without 'r' the file might get created!
  }

  public static async writeFileUtf8(path: string, content: string): Promise<void> {
    return await fs.writeFile(path, content);
  }

  public static async existsDir(path:string):Promise<boolean> {
    return await fs.stat(path).then(stat => stat.isDirectory()).catch((e) => false);
  }

  // this is the best recommended way to check file status in node 12+
  // only fs.stat() or fs.access() are not deprecated and both async
  public static async existsFile(path: string) {
    return await fs.stat(path).then(stat => stat.isFile()).catch((e) => false);
  }

  public static async mkDir(path: string): Promise<boolean> {
    await fs.mkdir(path, {recursive: true});
    return this.existsDir(path);
  }

  public static resolvePath(pathStr: string) : string {
    return path.resolve(pathStr);
  }

}