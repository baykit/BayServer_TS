export class FcgType {
    static readonly BEGIN_REQUEST: number = 1
    static readonly ABORT_REQUEST: number = 2
    static readonly END_REQUEST: number = 3
    static readonly PARAMS: number = 4
    static readonly STDIN: number = 5
    static readonly STDOUT: number = 6
    static readonly STDERR: number = 7
    static readonly DATA: number = 8
    static readonly GET_VALUES: number = 9
    static readonly GET_VALUES_RESULT: number = 10
    static readonly UNKNOWN_TYPE: number = 11
}