import {HNode} from "./hNode";

export class HTree {
    static root = new HNode()

    static decode(data: Buffer): string {
        let cur = this.root;
        let codePoints: number[] = []
        for(let i = 0; i < data.length; i++) {
            for(let j = 0; j < 8; j++) {
                let bit = data[i] >> (8 - j - 1) & 0x1;

                // down tree
                if(bit == 1) {
                    cur = cur.one;
                }
                else {
                    cur = cur.zero;
                }

                if(cur.value > 0) {
                    // leaf node
                    codePoints.push(cur.value);
                    cur = this.root;
                }
            }
        }
        return String.fromCodePoint(...codePoints)
    }

    static insert(code: number, lenInBits: number, sym: number): void {
        let bits: number[] = [];
        for (let i = 0; i < lenInBits; i++) {
            bits[i] = code >> (lenInBits - i - 1) & 0x1;
        }
        this.insertBits(bits, sym);
    }

    static insertBits(code: number[], sym: number): void {
        let curNode = this.root;
        for(let i = 0; i < code.length; i++) {
            if(code[i] == 1) {
                if(curNode.one == null) {
                    curNode.one = new HNode();
                }
                curNode = curNode.one;
            }
            else {
                if(curNode.zero == null) {
                    curNode.zero = new HNode();
                }
                curNode = curNode.zero;
            }
        }
        curNode.value = sym;
    }
    
    static initTree() {
        this.insert(0x1ff8,13,0);
        this.insert(0x7fffd8,23,1);
        this.insert(0xfffffe2,28,2);
        this.insert(0xfffffe3,28,3);
        this.insert(0xfffffe4,28,4);
        this.insert(0xfffffe5,28,5);
        this.insert(0xfffffe6,28,6);
        this.insert(0xfffffe7,28,7);
        this.insert(0xfffffe8,28,8);
        this.insert(0xffffea,24,9);
        this.insert(0x3ffffffc,30,10);
        this.insert(0xfffffe9,28,11);
        this.insert(0xfffffea,28,12);
        this.insert(0x3ffffffd,30,13);
        this.insert(0xfffffeb,28,14);
        this.insert(0xfffffec,28,15);
        this.insert(0xfffffed,28,16);
        this.insert(0xfffffee,28,17);
        this.insert(0xfffffef,28,18);
        this.insert(0xffffff0,28,19);
        this.insert(0xffffff1,28,20);
        this.insert(0xffffff2,28,21);
        this.insert(0x3ffffffe,30,22);
        this.insert(0xffffff3,28,23);
        this.insert(0xffffff4,28,24);
        this.insert(0xffffff5,28,25);
        this.insert(0xffffff6,28,26);
        this.insert(0xffffff7,28,27);
        this.insert(0xffffff8,28,28);
        this.insert(0xffffff9,28,29);
        this.insert(0xffffffa,28,30);
        this.insert(0xffffffb,28,31);
        this.insert(0x14,6,32);
        this.insert(0x3f8,10,33);
        this.insert(0x3f9,10,34);
        this.insert(0xffa,12,35);
        this.insert(0x1ff9,13,36);
        this.insert(0x15,6,37);
        this.insert(0xf8,8,38);
        this.insert(0x7fa,11,39);
        this.insert(0x3fa, 10, 40);
        this.insert(0x3fb,10,41);
        this.insert(0xf9,8,42);
        this.insert(0x7fb,11,43);
        this.insert(0xfa,8,44);
        this.insert(0x16,6,45);
        this.insert(0x17,6,46);
        this.insert(0x18,6,47);
        this.insert(0x0,5,48);
        this.insert(0x1,5,49);
        this.insert(0x2,5,50);
        this.insert(0x19,6,51);
        this.insert(0x1a,6,52);
        this.insert(0x1b,6,53);
        this.insert(0x1c,6,54);
        this.insert(0x1d,6,55);
        this.insert(0x1e,6,56);
        this.insert(0x1f,6,57);
        this.insert(0x5c,7,58);
        this.insert(0xfb,8,59);
        this.insert(0x7ffc,15,60);
        this.insert(0x20,6,61);
        this.insert(0xffb,12,62);
        this.insert(0x3fc,10,63);
        this.insert(0x1ffa,13,64);
        this.insert(0x21,6,65);
        this.insert(0x5d,7,66);
        this.insert(0x5e,7,67);
        this.insert(0x5f,7,68);
        this.insert(0x60,7,69);
        this.insert(0x61,7,70);
        this.insert(0x62,7,71);
        this.insert(0x63,7,72);
        this.insert(0x64,7,73);
        this.insert(0x65,7,74);
        this.insert(0x66,7,75);
        this.insert(0x67,7,76);
        this.insert(0x68,7,77);
        this.insert(0x69,7,78);
        this.insert(0x6a,7,79);
        this.insert(0x6b,7,80);
        this.insert(0x6c,7,81);
        this.insert(0x6d,7,82);
        this.insert(0x6e,7,83);
        this.insert(0x6f,7,84);
        this.insert(0x70,7,85);
        this.insert(0x71,7,86);
        this.insert(0x72,7,87);
        this.insert(0xfc,8,88);
        this.insert(0x73,7,89);
        this.insert(0xfd,8,90);
        this.insert(0x1ffb,13,91);
        this.insert(0x7fff0,19,92);
        this.insert(0x1ffc,13,93);
        this.insert(0x3ffc,14,94);
        this.insert(0x22,6,95);
        this.insert(0x7ffd,15,96);
        this.insert(0x3,5,97);
        this.insert(0x23,6,98);
        this.insert(0x4,5,99);
        this.insert(0x24,6,100);
        this.insert(0x5,5,101);
        this.insert(0x25,6,102);
        this.insert(0x26,6,103);
        this.insert(0x27,6,104);
        this.insert(0x6,5,105);
        this.insert(0x74,7,106);
        this.insert(0x75,7,107);
        this.insert(0x28,6,108);
        this.insert(0x29,6,109);
        this.insert(0x2a,6,110);
        this.insert(0x7,5,111);
        this.insert(0x2b,6,112);
        this.insert(0x76,7,113);
        this.insert(0x2c,6,114);
        this.insert(0x8,5,115);
        this.insert(0x9,5,116);
        this.insert(0x2d,6,117);
        this.insert(0x77,7,118);
        this.insert(0x78,7,119);
        this.insert(0x79,7,120);
        this.insert(0x7a,7,121);
        this.insert(0x7b,7,122);
        this.insert(0x7ffe,15,123);
        this.insert(0x7fc,11,124);
        this.insert(0x3ffd,14,125);
        this.insert(0x1ffd,13,126);
        this.insert(0xffffffc,28,127);
        this.insert(0xfffe6,20,128);
        this.insert(0x3fffd2,22,129);
        this.insert(0xfffe7,20,130);
        this.insert(0xfffe8,20,131);
        this.insert(0x3fffd3,22,132);
        this.insert(0x3fffd4,22,133);
        this.insert(0x3fffd5,22,134);
        this.insert(0x7fffd9,23,135);
        this.insert(0x3fffd6,22,136);
        this.insert(0x7fffda,23,137);
        this.insert(0x7fffdb,23,138);
        this.insert(0x7fffdc,23,139);
        this.insert(0x7fffdd,23,140);
        this.insert(0x7fffde,23,141);
        this.insert(0xffffeb,24,142);
        this.insert(0x7fffdf,23,143);
        this.insert(0xffffec,24,144);
        this.insert(0xffffed,24,145);
        this.insert(0x3fffd7,22,146);
        this.insert(0x7fffe0,23,147);
        this.insert(0xffffee,24,148);
        this.insert(0x7fffe1,23,149);
        this.insert(0x7fffe2,23,150);
        this.insert(0x7fffe3,23,151);
        this.insert(0x7fffe4,23,152);
        this.insert(0x1fffdc,21,153);
        this.insert(0x3fffd8,22,154);
        this.insert(0x7fffe5,23,155);
        this.insert(0x3fffd9,22,156);
        this.insert(0x7fffe6,23,157);
        this.insert(0x7fffe7,23,158);
        this.insert(0xffffef,24,159);
        this.insert(0x3fffda,22,160);
        this.insert(0x1fffdd,21,161);
        this.insert(0xfffe9,20,162);
        this.insert(0x3fffdb,22,163);
        this.insert(0x3fffdc,22,164);
        this.insert(0x7fffe8,23,165);
        this.insert(0x7fffe9,23,166);
        this.insert(0x1fffde,21,167);
        this.insert(0x7fffea,23,168);
        this.insert(0x3fffdd,22,169);
        this.insert(0x3fffde,22,170);
        this.insert(0xfffff0,24,171);
        this.insert(0x1fffdf,21,172);
        this.insert(0x3fffdf,22,173);
        this.insert(0x7fffeb,23,174);
        this.insert(0x7fffec,23,175);
        this.insert(0x1fffe0,21,176);
        this.insert(0x1fffe1,21,177);
        this.insert(0x3fffe0,22,178);
        this.insert(0x1fffe2,21,179);
        this.insert(0x7fffed,23,180);
        this.insert(0x3fffe1,22,181);
        this.insert(0x7fffee,23,182);
        this.insert(0x7fffef,23,183);
        this.insert(0xfffea,20,184);
        this.insert(0x3fffe2,22,185);
        this.insert(0x3fffe3,22,186);
        this.insert(0x3fffe4,22,187);
        this.insert(0x7ffff0,23,188);
        this.insert(0x3fffe5,22,189);
        this.insert(0x3fffe6,22,190);
        this.insert(0x7ffff1,23,191);
        this.insert(0x3ffffe0,26,192);
        this.insert(0x3ffffe1,26,193);
        this.insert(0xfffeb,20,194);
        this.insert(0x7fff1,19,195);
        this.insert(0x3fffe7,22,196);
        this.insert(0x7ffff2,23,197);
        this.insert(0x3fffe8,22,198);
        this.insert(0x1ffffec,25,199);
        this.insert(0x3ffffe2,26,200);
        this.insert(0x3ffffe3,26,201);
        this.insert(0x3ffffe4,26,202);
        this.insert(0x7ffffde,27,203);
        this.insert(0x7ffffdf,27,204);
        this.insert(0x3ffffe5,26,205);
        this.insert(0xfffff1,24,206);
        this.insert(0x1ffffed,25,207);
        this.insert(0x7fff2,19,208);
        this.insert(0x1fffe3,21,209);
        this.insert(0x3ffffe6,26,210);
        this.insert(0x7ffffe0,27,211);
        this.insert(0x7ffffe1,27,212);
        this.insert(0x3ffffe7,26,213);
        this.insert(0x7ffffe2,27,214);
        this.insert(0xfffff2,24,215);
        this.insert(0x1fffe4,21,216);
        this.insert(0x1fffe5,21,217);
        this.insert(0x3ffffe8,26,218);
        this.insert(0x3ffffe9,26,219);
        this.insert(0xffffffd,28,220);
        this.insert(0x7ffffe3,27,221);
        this.insert(0x7ffffe4,27,222);
        this.insert(0x7ffffe5,27,223);
        this.insert(0xfffec,20,224);
        this.insert(0xfffff3,24,225);
        this.insert(0xfffed,20,226);
        this.insert(0x1fffe6,21,227);
        this.insert(0x3fffe9,22,228);
        this.insert(0x1fffe7,21,229);
        this.insert(0x1fffe8,21,230);
        this.insert(0x7ffff3,23,231);
        this.insert(0x3fffea,22,232);
        this.insert(0x3fffeb,22,233);
        this.insert(0x1ffffee,25,234);
        this.insert(0x1ffffef,25,235);
        this.insert(0xfffff4,24,236);
        this.insert(0xfffff5,24,237);
        this.insert(0x3ffffea,26,238);
        this.insert(0x7ffff4,23,239);
        this.insert(0x3ffffeb,26,240);
        this.insert(0x7ffffe6,27,241);
        this.insert(0x3ffffec,26,242);
        this.insert(0x3ffffed,26,243);
        this.insert(0x7ffffe7,27,244);
        this.insert(0x7ffffe8,27,245);
        this.insert(0x7ffffe9,27,246);
        this.insert(0x7ffffea,27,247);
        this.insert(0x7ffffeb,27,248);
        this.insert(0xffffffe,28,249);
        this.insert(0x7ffffec,27,250);
        this.insert(0x7ffffed,27,251);
        this.insert(0x7ffffee,27,252);
        this.insert(0x7ffffef,27,253);
        this.insert(0x7fffff0,27,254);
        this.insert(0x3ffffee,26,255);
        this.insert(0x3fffffff,30,256);        
    }
}

HTree.initTree()
