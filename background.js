async function blockUrlInTab() {
    const {id: targetTabId} = await chrome.tabs.create({ url: 'https://www.youtube.com/feed/history', active: false });
    const ruleId = 1;

    const rule = {
        id: ruleId,
        priority: 1,
        action: { type: "block" },
        condition: {
            urlFilter: "*ytimg.com/vi/*",
            tabIds: [targetTabId], 
            resourceTypes: ["image"]
        }
    };

    await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [ruleId],
        addRules: [rule]
    });

    console.log(`Rule activated for tab ${targetTabId}`);
    
    chrome.tabs.onRemoved.addListener(async function cleanup (tabId, removeInfo) {
        if (tabId === targetTabId || removeInfo.isWindowClosing) {
            await chrome.declarativeNetRequest.updateSessionRules({
                removeRuleIds: [ruleId]
            });
            chrome.tabs.onRemoved.removeListener(cleanup);
        }
    });

}
blockUrlInTab();