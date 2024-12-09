import crypto from "crypto";
import {Wallet} from "ethers";
import {FileUtil} from "./FileUtil";

export class KeyUtil {

  static createEthPrivateKey() {
    return "0x" + crypto.randomBytes(32).toString("hex");
  }

  static async createEthPrivateKeyAsJson(pass: string): Promise<{ addr: string, pubKey: string, privKey: string, jsonContent: string }> {
    const privKey = KeyUtil.createEthPrivateKey();
    const wallet1 = new Wallet(privKey);
    let jsonContent = await wallet1.encrypt(pass);
    return {addr: wallet1.address, pubKey: wallet1.publicKey, privKey: wallet1.privateKey, jsonContent};
  }

  static async createEthPrivateKeyAsFile(pass: string, filePath: string): Promise<{ addr: string }> {
    let key = await this.createEthPrivateKeyAsJson(pass);
    await FileUtil.writeFileUtf8(filePath, key.jsonContent);
    return {addr: key.addr};
  }

  static async readEthPrivateKeyAddress(jsonFilePath: string): Promise<string> {
    const jsonData = JSON.parse(await FileUtil.readFileUtf8(jsonFilePath));
    return jsonData.address;
  }

}