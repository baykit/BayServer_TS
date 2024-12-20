export interface Recipient {
    /**
     * Receives letters.
     */
    receive(wait: boolean): Promise<void>

    /**
     * Wakes up the recipient
     */
    wakeup(): void
}