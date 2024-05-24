import Dexie from 'dexie';

class NavigationDatabase {
    constructor(dbName = 'NavigationDatabase') {
        if (!NavigationDatabase.instance) {
            this.db = new Dexie(dbName);

            // Define the database schema
            this.db.version(1).stores({
                navigationTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img',
                navigationHistoryTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img'
            });

            NavigationDatabase.instance = this;
        }

        return NavigationDatabase.instance;
    }

    timeStamp() {
        let d = new Date();
        let seconds = Math.round(d.getTime() / 1000);
        return seconds;
    }

    // Add a new tab info record
    async addTabInfo(tableName, tabInfo) {
        try {
            await this.db[tableName].add(tabInfo);
            let response = `Tab info for ${tabInfo.curTabId} added successfully to table ${tableName}.`;
            console.log(response);
        } catch (error) {
            console.error('Failed to add tab info:', error);
        }
    }

    // Add new table
    async addTable(tableName, fields) {
        try {
            // Dynamically generate the schema for the new table
            const schema = fields.map(field => field.name).join(', ');
    
            // Add the new table to the database schema
            this.db.version(this.db.verno).stores({
                ...this.db.tables,
                tableName: schema
            }).upgrade(); // Upgrade the database to apply the changes

            console.log('Table added successfully:', tableName);
        } catch (error) {
            console.error('Failed to add table:', error);
        }
    }

    // Check if a tab info record exists in navigationTable
    async tabInfoExists(curTabId) {
        try {
            const count = await this.db.navigationTable.where('curTabId').equals(curTabId).count();
            return count > 0;
        } catch (error) {
            console.error('Failed to check if tab info exists:', error);
            return false;
        }
    }

    // check if a tab info record exists in navigationHistoryTable
    async tabInfoExistsInHistory(curTabId) {
        try {
            const count = await this.db.navigationHistoryTable.where('curTabId').equals(curTabId).count();
            return count > 0;
        } catch (error) {
            console.error('Failed to check if tab info exists:', error);
            return false;
        }
    }

    // Update tab info based on curTabId, only for navigationTable and navigationHistoryTable
    async updateTabInfoByCurTabId(curTabId, updates) {
        try {
            // update the time field
            updates.time = this.timeStamp(); // this lets us know when the tab was last updated (usually when the recording status changes)

            // await this.db.navigationTable.where('curTabId').equals(curTabId).modify(updates);
            await this.addTabInfo('navigationTable', updates);
            console.log(`Tab info with curTabId ${curTabId} updated successfully in navigationTable.`);
            const existsInHistoryTable = await this.tabInfoExistsInHistory(curTabId);
            if(updates.recording === true && !existsInHistoryTable){
                console.log(`Tab info with curTabId ${curTabId} does not exist in navigationHistoryTable yet. Adding it now`);
                await this.addTabInfo('navigationHistoryTable', updates);
            } else {
                await this.db.navigationHistoryTable.where('curTabId').equals(curTabId).modify(updates);
                console.log(`Tab info with curTabId ${curTabId} updated successfully in navigationHistoryTable.`);
            }
        } catch (error) {
            console.error(`Failed to update tab info with curTabId ${curTabId}:`, error);
        }
    }

    // Retrieve a tab info record by tab id
    async getTabInfoByTabId(tableName, tabId) {
        try {
            if(this.db[tableName].length > 0){
                return await this.db[tableName].where({ curTabId: tabId }).first();
            } else {
                let response = `No tab info records found for table ${tableName} (tabId=${tabId}).`
                console.log(response);
                return null;
            }
        } catch (error) {
            console.error(`Failed to retrieve tab info for tabId ${tabId}:`, error);
            return null;
        }
    }    

    // Retrieve all tab info records
    async getAllTabInfos(tableName){
        try {
            return await this.db[tableName].toArray();
        } catch (error) {
            console.error('Failed to retrieve tab infos:', error);
            return []; // Return an empty array on error
        }
    }

    // Retrieve all tab info records by recording
    async getTabInfosByRecording(tableName, recording){
        try {
            if(this.db[tableName].length > 0){
                return await this.db[tableName].where({ recording: recording }).toArray();
            } else {
                let response = `No tab info records found for table ${tableName} (recording=${recording}).`
                console.log(response);
                return [];
            }
        } catch (error) {
            console.error('Failed to retrieve tab infos:', error);
            return []; // Return an empty array on error
        }
    }

    // Delete tab info records by tab id
    async deleteTabInfoByTabId(tableName, tabId) {
        try {
            await this.db[tableName].where({ curTabId: tabId }).delete();
            let response = `Tab info with tabId ${tabId} deleted successfully from table ${tableName}.`;
            console.log(response);
        } catch (error) {
            console.error(`Failed to delete tab info with tabId ${tabId}:`, error);
        }
    }

    // Delete all tab info records
    async clearAllTabInfos() {
        try {
            for (const tableName in this.db.tables) {
                await this.db[tableName].clear();
            }
            console.log('All tab info records deleted successfully.');
        } catch (error) {
            console.error('Failed to clear tab info records:', error);
        }
    }
}

const navigationDB = new NavigationDatabase();
Object.freeze(navigationDB);

export default navigationDB;