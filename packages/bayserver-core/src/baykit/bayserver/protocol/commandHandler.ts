import {Command} from "./command";
import {Reusable} from "../util/Reusable";

export interface CommandHandler <C extends Command<C, any, any>> extends Reusable {
}