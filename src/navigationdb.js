import Dexie from 'dexie';

export class NavigationDatabase {
    constructor() {
        // Initialize Dexie database
        this.db = new Dexie('NavigationDatabase');
        // Define the database schema
        this.db.version(1).stores({
            navigationTable: '++id, curTabId, curUrl, prevUrl, prevTabId, curTitle, recording, action, time, img',
        });
    }

    // Add a new tab info record
    async addTabInfo(tabInfo) {
        try {
            await this.db.navigationTable.add(tabInfo);
            console.log('Tab info added successfully:', tabInfo);
        } catch (error) {
            console.error('Failed to add tab info:', error);
        }
    }

    // Update an existing tab info record
    async updateTabInfo(id, updates) {
        try {
            await this.db.navigationTable.update(id, updates);
            console.log(`Tab info with id ${id} updated successfully.`);
        } catch (error) {
            console.error(`Failed to update tab info with id ${id}:`, error);
        }
    }

    // bulk insert
    async bulkAddOrUpdateTabInfos(tabInfos) {
        try {
            await this.db.transaction('rw', this.db.navigationTable, async () => {
                for (let tabInfo of tabInfos) {
                    if (await this.db.navigationTable.where({ curTabId: tabInfo.curTabId }).count() === 0) {
                        await this.db.navigationTable.add(tabInfo);
                    } else {
                        await this.db.navigationTable.where({ curTabId: tabInfo.curTabId }).modify(tabInfo);
                    }
                }
            });
            console.log('Bulk add or update operation completed successfully.');
        } catch (error) {
            console.error('Failed to perform bulk add or update:', error);
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

    // Delete a tab info record by id
    async deleteTabInfoById(id) {
        try {
            await this.db.navigationTable.delete(id);
            console.log(`Tab info with id ${id} deleted successfully.`);
        } catch (error) {
            console.error(`Failed to delete tab info with id ${id}:`, error);
        }
    }

    // Delete all tab info records
    async clearAllTabInfos() {
        try {
            await this.db.navigationTable.clear();
            console.log('All tab info records deleted successfully.');
        } catch (error) {
            console.error('Failed to clear tab info records:', error);
        }
    }    
}
