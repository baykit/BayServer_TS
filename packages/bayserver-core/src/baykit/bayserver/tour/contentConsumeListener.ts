export type ContentConsumeListener = (len: number, resume: boolean) => void;

export class ContentConsumeListenerUtil {
    static readonly devNull: ContentConsumeListener = (len, resume) => {}
}
