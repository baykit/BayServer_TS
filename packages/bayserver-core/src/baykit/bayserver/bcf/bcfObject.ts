export abstract class BcfObject {
    public fileName: string;
    public lineNo: number;

    public constructor(fileName: string, lineNo: number) {
        this.fileName = fileName;
        this.lineNo = lineNo;
    }
}