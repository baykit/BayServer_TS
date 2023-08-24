import {env} from "process";
import {StrUtil} from "./strUtil";

export class Locale {
    language : string
    country : string

    constructor(language: string, country: string) {
        this.language = language
        this.country = country
    }

    static getDefault(): Locale {
        let lang = env["LANG"]
        if (StrUtil.isSet(lang)) {
            let language = lang.substring(0, 2)
            let country = lang.substring(3, 5)
            return new Locale(language, country)
        }

        return new Locale("en", "US")
    }
    
}