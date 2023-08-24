import {BcfElement} from "../bcf/bcfElement";

export interface Docker {
    init(ini: BcfElement, parent: Docker )

    getType(): string
}