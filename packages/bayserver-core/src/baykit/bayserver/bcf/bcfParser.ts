import { BayMessage } from "../bayMessage";
import { Symbol } from "../symbol";
import { ArrayUtil } from "../util/arrayUtil";
import { BcfDocument } from "./bcfDocument";
import { BcfObject } from "./bcfObject";
import { ParseException } from "./parse_exception";
import { readFileSync } from "fs"
import { BcfElement } from "./bcfElement";
import { BcfKeyVal } from "./bcfKeyVal";
import {BayLog} from "../bayLog";
import {IOUtil} from "../util/ioUtil";
import {Buffer} from "buffer";

class LineInfo {

    public lineObj: BcfObject;
    public indent: number;
    
    public constructor(lineObj: BcfObject, indent: number) {
        this.lineObj = lineObj;
        this.indent = indent;
    }
}


export class BcfParser {
    
    prevLineInfo: LineInfo;
    fileName: string;
    indentMap: number[] = [];
    input: string[]
    lineNo: number = 0;

        

    private pushIndent(spCount: number) {
        this.indentMap.push(spCount);
    }
    
    private popIndent() {
        this.indentMap.splice(this.indentMap.length - 1, 1);
    }
    
    private getIndent(spCount: number): number {
        if(ArrayUtil.empty(this.indentMap))
            this.pushIndent(spCount);
        else if(spCount > this.indentMap[this.indentMap.length - 1]) {
            this.pushIndent(spCount);
        }
        let indent = this.indentMap.indexOf(spCount);
        if(indent == -1)
            throw new ParseException(this.fileName, this.lineNo, BayMessage.get(Symbol.PAS_INVALID_INDENT));
        return indent;
    }
    
    public parse(file: string) : BcfDocument {
        let doc = new BcfDocument();
        let currentContentList = doc.contentList;
        let parentContentList = null;

        this.fileName = file;
        this.lineNo = 0;
        try {
            this.input = readFileSync(file).toString().split("\n")
            this.parseSameLevel(doc.contentList, 0);
        }
        catch(e) {
            if(e instanceof ParseException)
                throw e
            else
                throw new ParseException(file, this.lineNo, e);
        }
        finally {
        }
        return doc;
    }

    
    private parseSameLevel(curList: BcfObject[], indent: number): LineInfo {
        let objectExistsInSameLevel = false;
        while (true) {
            var lineInfo: LineInfo;
            if(this.prevLineInfo != null) {
                lineInfo = this.prevLineInfo;
                this.prevLineInfo = null;
                //BayServer.debug("returned line=" + lineInfo.lineObj + " indent=" + lineInfo.indent + " cur=" + indent);
            }
            else {
                if(this.lineNo == this.input.length)
                    break

                let line: string = this.input[this.lineNo++]

                if(line.trim().startsWith("#") || line.trim() == "") {
                    // comment or empty line
                    continue
                }

                lineInfo = this.parseLine(this.lineNo, line);
                //BayServer.debug("line=" + line + " indent=" + lineInfo.indent + " cur=" + indent);
            }
            
            if(lineInfo == null) {
                // comment or empty
                continue;
            }
            else if(lineInfo.indent > indent) {
                // lower level
                throw new ParseException(this.fileName, this.lineNo, BayMessage.get(Symbol.PAS_INVALID_INDENT));
            }
            else if(lineInfo.indent < indent) {
                // upper level
                this.prevLineInfo = lineInfo;
                if(objectExistsInSameLevel)
                    this.popIndent();
                return lineInfo;
            }
            else {
                objectExistsInSameLevel = true;
                // same level
                if(lineInfo.lineObj instanceof BcfElement) {                     
                    curList.push(lineInfo.lineObj);

                    let elm: BcfElement = lineInfo.lineObj as BcfElement;
                    let lastLineInfo: LineInfo = this.parseSameLevel(elm.contentList, lineInfo.indent + 1);
                    if(lastLineInfo == null) {
                        // EOF
                        this.popIndent();
                        return null;
                    }
                    else {
                        // Same level
                        continue;
                    }
                }
                else {                     
                    curList.push(lineInfo.lineObj);                     
                    continue;
                }
            }
        }
        this.popIndent();
        return null;
    }
    
    private parseLine(lineNo: number, line: string) : LineInfo {
        
        var spCount: number;
        for(spCount = 0; spCount < line.length; spCount++) {
            let c: string = line[spCount];
            if(c.trim() != "")
                break;

            if(c != ' ')
                throw new ParseException(this.fileName, lineNo, BayMessage.get(Symbol.PAS_INVALID_WHITESPACE));
        }
        let indent: number = this.getIndent(spCount);
        
        line = line.substring(spCount);
        line = line.trim();
        
        if(line.startsWith("[")) {
            let closePos: number = line.indexOf("]");
            if(closePos == -1) {
                throw new ParseException(this.fileName, lineNo, BayMessage.get(Symbol.PAS_BRACE_NOT_CLOSED));
            }
            if(!line.endsWith("]")) {
                throw new ParseException(this.fileName, lineNo, BayMessage.get(Symbol.PAS_INVALID_LINE));
            }
            let keyVal: BcfKeyVal = this.parseKeyVal(line.substring(1, closePos), lineNo);
            return new LineInfo(
                    new BcfElement(
                            keyVal.key, 
                            keyVal.value,
                            this.fileName,
                            lineNo),
                    indent);
        }
        else {
            return new LineInfo(this.parseKeyVal(line, lineNo), indent);
        }
    }
    
    private parseKeyVal(line: string, lineNo: number): BcfKeyVal {
        let spPos: number = line.indexOf(' ');
        let key: string = spPos == -1 ? line : line.substring(0, spPos);
        let val: string = spPos == -1 ? "" : line.substring(spPos).trim();
        return new BcfKeyVal(key, val, this.fileName,lineNo);
    }
}
