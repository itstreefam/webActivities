import Dexie from 'dexie';

export class NavigationDatabase {
    constructor() {
        // Initialize Dexie database
        this.db = new Dexie('NavigationDatabase');
        // Define the database schema
        this.db.version(1).stores({
            navigationTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img',
            navigationHistoryTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img'
        });
    }

    // Add a new tab info record
    async addTabInfo(tabInfo) {
        try {
            await this.db.navigationTable.add(tabInfo);
            if (tabInfo.recording === true){
                await this.db.navigationHistoryTable.add(tabInfo);
            }
            console.log('Tab info added successfully:', tabInfo);
        } catch (error) {
            console.error('Failed to add tab info:', error);
        }
    }

    // Update an existing tab info record
    async updateTabInfo(id, updates) {
        try {
            await this.db.navigationTable.update(id, updates);
            if (updates.recording === true){
                await this.db.navigationHistoryTable.update(id, updates);
            }
            console.log(`Tab info with id ${id} updated successfully.`);
        } catch (error) {
            console.error(`Failed to update tab info with id ${id}:`, error);
        }
    }

    // Update tab info based on curTabId
    async updateTabInfoByCurTabId(curTabId, updates) {
        try {
            await db.navigationTable.where('curTabId').equals(curTabId).modify(updates);
            if (updates.recording === true){
                await db.navigationHistoryTable.where('curTabId').equals(curTabId).modify(updates);
            }
            console.log(`Tab info with curTabId ${curTabId} updated successfully.`);
        } catch (error) {
            console.error(`Failed to update tab info with curTabId ${curTabId}:`, error);
        }
    }

    // Retrieve a tab info record by tab id
    async getTabInfoByTabId(tabId) {
        try {
            return await this.db.navigationTable.where({ curTabId: tabId }).first();
        } catch (error) {
            console.error(`Failed to retrieve tab info for tabId ${tabId}:`, error);
            return null;
        }
    }    

    // Retrieve all tab info records
    async getAllTabInfos() {
        try {
            return await this.db.navigationTable.toArray();
        } catch (error) {
            console.error('Failed to retrieve tab infos:', error);
            return []; // Return an empty array on error
        }
    }

    // Retrieve tab info records that have recording flag set to true
    async getRecordingTabInfos() {
        try {
            // return await this.db.navigationTable.filter(tabInfo => tabInfo.recording === true).toArray();
            return await this.db.navigationHistoryTable.toArray();
        } catch (error) {
            console.error('Failed to retrieve recording tab infos:', error);
            return []; // Return an empty array on error
        }
    }

    // Delete a tab info record by id
    async deleteTabInfoById(id) {
        try {
            await this.db.navigationTable.delete(id);
            console.log(`Tab info with id ${id} deleted successfully.`);
        } catch (error) {
            console.error(`Failed to delete tab info with id ${id}:`, error);
        }
    }

    // Delete tab info records by tab id
    async deleteTabInfoByTabId(tabId) {
        try {
            await this.db.navigationTable.where({ curTabId: tabId }).delete();
            console.log(`Tab info with tabId ${tabId} deleted successfully.`);
        } catch (error) {
            console.error(`Failed to delete tab info with tabId ${tabId}:`, error);
        }
    }

    // Delete all tab info records
    async clearAllTabInfos() {
        try {
            await this.db.navigationTable.clear();
            await this.db.navigationHistoryTable.clear();
            console.log('All tab info records deleted successfully.');
        } catch (error) {
            console.error('Failed to clear tab info records:', error);
        }
    }    
}
