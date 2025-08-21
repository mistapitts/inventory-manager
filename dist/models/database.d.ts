import sqlite3 from 'sqlite3';
export declare class Database {
    db: sqlite3.Database;
    constructor();
    private init;
    private createTables;
    private addMissingColumns;
    private addMissingListColumns;
    private migrateRecordTablesIfNeeded;
    private createAdminUser;
    run(sql: string, params?: any[]): Promise<void>;
    get(sql: string, params?: any[]): Promise<any>;
    all(sql: string, params?: any[]): Promise<any[]>;
    private generateId;
    close(): void;
}
export declare const database: Database;
//# sourceMappingURL=database.d.ts.map