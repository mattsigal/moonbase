// Moonfin Web Plugin - Built 2026-05-30T00:15:19.319Z
(function() {
"use strict";

// === utils/device.js ===
const Device = {
    _cache: null,

    detect() {
        if (this._cache) return this._cache;

        const ua = navigator.userAgent.toLowerCase();
        const width = window.innerWidth;
        const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua);
        const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(ua) || (hasTouch && width >= 768 && width <= 1024);
        const isTV = /tv|tizen|webos|smart-tv|netcast|hbbtv|vidaa|viera/i.test(ua);
        const isDesktop = !isMobile && !isTablet && !isTV;

        this._cache = {
            type: isTV ? 'tv' : isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
            isMobile: isMobile || isTablet,
            isDesktop,
            isTV,
            isTablet,
            hasTouch,
            screenWidth: width,
            screenHeight: window.innerHeight,
            userAgent: navigator.userAgent
        };

        console.log('[Moonfin] Device detected:', this._cache.type);
        return this._cache;
    },

    isMobile() {
        return this.detect().isMobile;
    },

    isDesktop() {
        return this.detect().isDesktop;
    },

    isTV() {
        return this.detect().isTV;
    },

    hasTouch() {
        return this.detect().hasTouch;
    },

    getInfo() {
        return this.detect();
    },

    getProfileName() {
        const info = this.detect();
        if (info.isTV) return 'tv';
        if (info.isMobile) return 'mobile';
        return 'desktop';
    }
};


// === utils/api.js ===
const API = {
    toCamelCase: function(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
        var result = {};
        var keys = Object.keys(obj);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            var camel = key.charAt(0).toLowerCase() + key.slice(1);
            result[camel] = obj[key];
        }
        return result;
    },

    getApiClient() {
        return window.ApiClient || (window.connectionManager && window.connectionManager.currentApiClient());
    },

    async getCurrentUser() {
        const api = this.getApiClient();
        if (!api) return null;
        
        try {
            const user = await api.getCurrentUser();
            return user;
        } catch (e) {
            console.error('[Moonfin] Failed to get current user:', e);
            return null;
        }
    },

    async getUserViews() {
        const api = this.getApiClient();
        if (!api) return [];

        try {
            const userId = api.getCurrentUserId();
            const result = await api.getUserViews(userId);
            return result.Items || [];
        } catch (e) {
            console.error('[Moonfin] Failed to get user views:', e);
            return [];
        }
    },

    async getMediaBarItems(profile) {
        const api = this.getApiClient();
        if (!api) return null;

        try {
            const serverUrl = api.serverAddress?.() || '';
            const token = api.accessToken?.();
            const headers = token ? { Authorization: 'MediaBrowser Token="' + token + '"' } : {};

            const profileParam = profile || 'global';
            const response = await fetch(
                serverUrl + '/Moonfin/MediaBar?profile=' + encodeURIComponent(profileParam),
                { method: 'GET', headers: headers }
            );

            if (response.ok) {
                const data = await response.json();
                return data.Items || data.items || [];
            }

            return null;
        } catch (e) {
            console.warn('[Moonfin] MediaBar endpoint not available, falling back:', e);
            return null;
        }
    },

    async getHomeRows(profile, language) {
        const api = this.getApiClient();
        if (!api) return null;

        try {
            const serverUrl = api.serverAddress?.() || '';
            const token = api.accessToken?.();
            const headers = token ? { Authorization: 'MediaBrowser Token="' + token + '"' } : {};

            var profileParam = profile || 'global';
            var langParam = language || (navigator.language || 'en');
            var url = serverUrl + '/Moonfin/HomeRows/' + encodeURIComponent(profileParam) + '?language=' + encodeURIComponent(langParam);
            const response = await fetch(url, { method: 'GET', headers: headers });

            if (!response.ok) return null;

            return this.toCamelCase(await response.json());
        } catch {
            return null;
        }
    },

    async getRandomItems(options = {}) {
        const api = this.getApiClient();
        if (!api) return [];

        const { limit = 10, libraryIds = [] } = options;

        try {
            const userId = api.getCurrentUserId();

            const baseParams = {
                userId: userId,
                includeItemTypes: 'Movie,Series',
                sortBy: 'Random',
                recursive: true,
                hasThemeSong: false,
                hasThemeVideo: false,
                fields: 'Overview,Genres,CommunityRating,CriticRating,OfficialRating,RunTimeTicks,ProductionYear,ProviderIds',
                imageTypeLimit: 1,
                enableImageTypes: 'Backdrop,Logo,Primary'
            };

            // When specific libraries are selected, query each and merge
            if (libraryIds && libraryIds.length > 0) {
                var allItems = [];
                var seenIds = {};

                for (var i = 0; i < libraryIds.length; i++) {
                    var params = Object.assign({}, baseParams, {
                        parentId: libraryIds[i],
                        limit: limit
                    });
                    var libResult = await api.getItems(userId, params);
                    var items = libResult.Items || [];
                    for (var j = 0; j < items.length; j++) {
                        if (!seenIds[items[j].Id]) {
                            seenIds[items[j].Id] = true;
                            allItems.push(items[j]);
                        }
                    }
                }

                // Shuffle the merged results
                for (var k = allItems.length - 1; k > 0; k--) {
                    var r = Math.floor(Math.random() * (k + 1));
                    var temp = allItems[k];
                    allItems[k] = allItems[r];
                    allItems[r] = temp;
                }

                return allItems.slice(0, limit);
            }

            // Default: all libraries
            baseParams.limit = limit;
            const result = await api.getItems(userId, baseParams);
            return result.Items || [];
        } catch (e) {
            console.error('[Moonfin] Failed to get random items:', e);
            return [];
        }
    },

    async getCollectionsAndPlaylists() {
        const api = this.getApiClient();
        if (!api) return [];

        try {
            const userId = api.getCurrentUserId();
            const result = await api.getItems(userId, {
                userId: userId,
                includeItemTypes: 'BoxSet,Playlist',
                sortBy: 'SortName',
                sortOrder: 'Ascending',
                recursive: true,
                fields: 'PrimaryImageAspectRatio',
                imageTypeLimit: 1,
                enableImageTypes: 'Primary'
            });
            return result.Items || [];
        } catch (e) {
            console.error('[Moonfin] Failed to get collections/playlists:', e);
            return [];
        }
    },

    async getItemTrailers(itemId) {
        const api = this.getApiClient();
        if (!api || !itemId) return [];

        try {
            const userId = api.getCurrentUserId();
            const result = await api.getItems(userId, {
                ids: itemId,
                userId: userId,
                fields: 'RemoteTrailers',
                limit: 1
            });
            const item = result.Items && result.Items[0];
            return (item && item.RemoteTrailers) || [];
        } catch (e) {
            return [];
        }
    },

    getImageUrl(item, imageType = 'Backdrop', options = {}) {
        const api = this.getApiClient();
        if (!api || !item) return null;

        const itemId = item.Id;
        const { maxWidth = 1920, maxHeight = 1080, quality = 96 } = options;

        if (!item.ImageTags || !item.ImageTags[imageType]) {
            // For backdrop, check BackdropImageTags
            if (imageType === 'Backdrop' && item.BackdropImageTags && item.BackdropImageTags.length > 0) {
                return api.getScaledImageUrl(itemId, {
                    type: 'Backdrop',
                    maxWidth,
                    maxHeight,
                    quality,
                    tag: item.BackdropImageTags[0]
                });
            }
            return null;
        }

        return api.getScaledImageUrl(itemId, {
            type: imageType,
            maxWidth,
            maxHeight,
            quality,
            tag: item.ImageTags[imageType]
        });
    },

    getUserAvatarUrl(user) {
        const api = this.getApiClient();
        if (!api || !user) return null;

        if (user.PrimaryImageTag) {
            return api.getUserImageUrl(user.Id, {
                type: 'Primary',
                tag: user.PrimaryImageTag
            });
        }
        return null;
    },

    navigateToItem(itemId) {
        if (window.Emby && window.Emby.Page) {
            window.Emby.Page.show('/details?id=' + itemId);
        } else if (window.appRouter) {
            window.appRouter.show('/details?id=' + itemId);
        }
    },

    navigateTo(path) {
        if (window.Emby && window.Emby.Page) {
            window.Emby.Page.show(path);
        } else if (window.appRouter) {
            window.appRouter.show(path);
        }
    },

    async getGenres(parentId) {
        var api = this.getApiClient();
        if (!api) return [];

        try {
            var userId = api.getCurrentUserId();
            var params = {
                userId: userId,
                includeItemTypes: 'Movie,Series',
                sortBy: 'SortName',
                sortOrder: 'Ascending',
                recursive: true,
                enableTotalRecordCount: true
            };
            if (parentId) {
                params.parentId = parentId;
            }
            var result = await api.getGenres(userId, params);
            return result.Items || [];
        } catch (e) {
            console.error('[Moonfin] Failed to get genres:', e);
            return [];
        }
    },

    async getGenreItems(genreName, options) {
        var api = this.getApiClient();
        if (!api) return { Items: [], TotalRecordCount: 0 };

        try {
            var userId = api.getCurrentUserId();
            var params = {
                userId: userId,
                genres: genreName,
                includeItemTypes: options.includeItemTypes || 'Movie,Series',
                sortBy: options.sortBy || 'SortName',
                sortOrder: options.sortOrder || 'Ascending',
                recursive: true,
                startIndex: options.startIndex || 0,
                limit: options.limit || 100,
                enableTotalRecordCount: true,
                fields: 'PrimaryImageAspectRatio,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks,Overview,Genres',
                imageTypeLimit: 1,
                enableImageTypes: 'Primary,Backdrop'
            };
            if (options.parentId) {
                params.parentId = options.parentId;
            }
            if (options.nameStartsWith) {
                params.nameStartsWith = options.nameStartsWith;
            }
            if (options.nameLessThan) {
                params.nameLessThan = options.nameLessThan;
            }
            var result = await api.getItems(userId, params);
            return result;
        } catch (e) {
            console.error('[Moonfin] Failed to get genre items:', e);
            return { Items: [], TotalRecordCount: 0 };
        }
    },

    async getLibraryItems(parentId, options) {
        var api = this.getApiClient();
        if (!api) return { Items: [], TotalRecordCount: 0 };

        try {
            options = options || {};
            var userId = api.getCurrentUserId();
            var params = {
                userId: userId,
                parentId: parentId,
                sortBy: options.sortBy || 'SortName',
                sortOrder: options.sortOrder || 'Ascending',
                recursive: options.recursive !== false,
                startIndex: options.startIndex || 0,
                limit: options.limit || 100,
                enableTotalRecordCount: true,
                fields: options.fields || 'PrimaryImageAspectRatio,ProductionYear,CommunityRating,OfficialRating,RunTimeTicks,Overview,Genres',
                imageTypeLimit: 1,
                enableImageTypes: 'Primary,Backdrop'
            };
            if (options.includeItemTypes) {
                params.includeItemTypes = options.includeItemTypes;
            }
            if (options.excludeItemTypes) {
                params.excludeItemTypes = options.excludeItemTypes;
            }
            if (options.filters) {
                params.filters = options.filters;
            }
            if (options.nameStartsWith) {
                params.nameStartsWith = options.nameStartsWith;
            }
            if (options.nameLessThan) {
                params.nameLessThan = options.nameLessThan;
            }
            var result = await api.getItems(userId, params);
            return result;
        } catch (e) {
            console.error('[Moonfin] Failed to get library items:', e);
            return { Items: [], TotalRecordCount: 0 };
        }
    },

    getPrimaryImageUrl(item, options) {
        var api = this.getApiClient();
        if (!api || !item) return null;

        var opts = options || {};
        var maxWidth = opts.maxWidth || 300;
        var quality = opts.quality || 90;

        if (item.ImageTags && item.ImageTags.Primary) {
            return api.getScaledImageUrl(item.Id, {
                type: 'Primary',
                maxWidth: maxWidth,
                quality: quality,
                tag: item.ImageTags.Primary
            });
        }
        return null;
    },

    getBackdropUrl(item, options) {
        var api = this.getApiClient();
        if (!api || !item) return null;

        var opts = options || {};
        var maxWidth = opts.maxWidth || 780;
        var quality = opts.quality || 80;

        if (item.BackdropImageTags && item.BackdropImageTags.length > 0) {
            return api.getScaledImageUrl(item.Id, {
                type: 'Backdrop',
                maxWidth: maxWidth,
                quality: quality,
                tag: item.BackdropImageTags[0]
            });
        }
        // Fallback for items without their own backdrop
        if (item.ParentBackdropItemId && item.ParentBackdropImageTags && item.ParentBackdropImageTags.length > 0) {
            return api.getScaledImageUrl(item.ParentBackdropItemId, {
                type: 'Backdrop',
                maxWidth: maxWidth,
                quality: quality,
                tag: item.ParentBackdropImageTags[0]
            });
        }
        return null;
    },

    // ===== Webpack Interop for Jellyfin Web Editor Dialogs =====
    // Editor modules (metadataEditor, imageeditor, subtitleeditor, itemidentifier) are in
    // separate lazy-loaded webpack chunks. We capture __webpack_require__ via the chunk push
    // trick, find the shortcuts.js + itemContextMenu.js modules by their unique strings,
    // extract the chunk IDs from their compiled source, load those chunks, then find the
    // editor modules by their export shapes.

    getServerId: function() {
        var api = this.getApiClient();
        if (!api) return null;
        try {
            if (api.serverInfo && typeof api.serverInfo === 'function') return api.serverInfo().Id;
            if (api._serverInfo) return api._serverInfo.Id;
            if (api.serverId && typeof api.serverId === 'function') return api.serverId();
        } catch(e) {}
        return null;
    },

    _initWebpackRequire: function() {
        if (window.__moonfin_wp_require) return true;
        // Auto-detect: the compiled global varies by build config
        // Production jellyfin-web uses just 'webpackChunk' (no suffix)
        var chunkArr = window.webpackChunk
            || window.webpackChunkjellyfin_web
            || window['webpackChunk_jellyfin_web'];
        if (!chunkArr) {
            // Scan window for any webpackChunk* array
            var keys = Object.keys(window);
            for (var i = 0; i < keys.length; i++) {
                if (keys[i].indexOf('webpackChunk') === 0 && Array.isArray(window[keys[i]])) {
                    chunkArr = window[keys[i]];
                    break;
                }
            }
        }
        if (!chunkArr) {
            console.warn('[Moonfin] No webpackChunk array found');
            return false;
        }
        chunkArr.push([['moonfin'], {}, function(__webpack_require__) {
            window.__moonfin_wp_require = __webpack_require__;
        }]);
        return !!window.__moonfin_wp_require;
    },

    _extractChunkIds: function(factorySource) {
        var ids = [];
        // Match numeric chunk IDs: .e(12345)
        var regex = /\.e\((\d+)\)/g;
        var match;
        while ((match = regex.exec(factorySource)) !== null) {
            var id = parseInt(match[1]);
            if (ids.indexOf(id) === -1) ids.push(id);
        }
        // Match string chunk IDs: .e("chunk-name")
        regex = /\.e\("([^"]+)"\)/g;
        while ((match = regex.exec(factorySource)) !== null) {
            if (ids.indexOf(match[1]) === -1) ids.push(match[1]);
        }
        return ids;
    },

    _loadChunks: function(req, chunkIds) {
        var loads = [];
        for (var i = 0; i < chunkIds.length; i++) {
            loads.push(req.e(chunkIds[i]).catch(function() {}));
        }
        return Promise.all(loads);
    },

    _findFactoryByHint: function(req, hint) {
        var factories = req.m || {};
        var keys = Object.keys(factories);
        for (var i = 0; i < keys.length; i++) {
            try {
                if (factories[keys[i]].toString().indexOf(hint) !== -1) {
                    return keys[i];
                }
            } catch(e) {}
        }
        return null;
    },

    _findFactoryByHints: function(req, hints) {
        var factories = req.m || {};
        var keys = Object.keys(factories);
        for (var i = 0; i < keys.length; i++) {
            try {
                var src = factories[keys[i]].toString();
                var allMatch = true;
                for (var h = 0; h < hints.length; h++) {
                    if (src.indexOf(hints[h]) === -1) { allMatch = false; break; }
                }
                if (allMatch) return keys[i];
            } catch(e) {}
        }
        return null;
    },

    _editorModulesPromise: null,

    _loadEditorModules: function() {
        if (this._editorModulesPromise) return this._editorModulesPromise;
        if (window.__moonfin_editors && Object.keys(window.__moonfin_editors).length >= 4) {
            return Promise.resolve(true);
        }

        var apiSelf = this;
        this._editorModulesPromise = new Promise(function(resolve) {
            if (!apiSelf._initWebpackRequire()) {
                resolve(false);
                return;
            }

            var req = window.__moonfin_wp_require;

            // Step 1: Find shortcuts.js module by its unique 'playAllFromHere' export
            var shortcutsId = apiSelf._findFactoryByHint(req, 'playAllFromHere');
            if (!shortcutsId) {
                console.warn('[Moonfin] Could not find shortcuts module in webpack factories');
                resolve(false);
                return;
            }

            // Step 2: Extract chunk IDs from shortcuts factory and load them
            var shortcutChunkIds = apiSelf._extractChunkIds(req.m[shortcutsId].toString());
            console.log('[Moonfin] Loading shortcuts chunks:', shortcutChunkIds);

            apiSelf._loadChunks(req, shortcutChunkIds).then(function() {
                // Step 3: Find itemContextMenu module by its unique command strings
                var icmId = apiSelf._findFactoryByHints(req, ['editimages', 'editsubtitles', 'identify']);
                if (icmId) {
                    // Step 4: Extract and load itemContextMenu's chunks (editor modules)
                    var icmChunkIds = apiSelf._extractChunkIds(req.m[icmId].toString());
                    console.log('[Moonfin] Loading itemContextMenu chunks:', icmChunkIds);
                    return apiSelf._loadChunks(req, icmChunkIds);
                }
            }).then(function() {
                // Step 5: All editor chunks loaded. Find editor modules by export shape.
                var editors = {};
                var factories = req.m;
                var cache = req.c || {};
                var fkeys = Object.keys(factories);

                // Source hints to narrow down which factories to try instantiating
                var editorHints = [
                    'editItemMetadataForm', 'MessageItemSaved',
                    'imageType', 'hasChanges',
                    'subtitleList', 'btnOpenUploadMenu',
                    'showFindNew', 'identifyResults'
                ];

                for (var i = 0; i < fkeys.length; i++) {
                    var id = fkeys[i];
                    var mod;

                    // Check cache first (no side effects)
                    if (cache[id]) {
                        mod = cache[id].exports;
                    } else {
                        // Only try modules whose factory contains editor-related strings
                        var src;
                        try { src = factories[id].toString(); } catch(e) { continue; }
                        var isEditor = false;
                        for (var h = 0; h < editorHints.length; h++) {
                            if (src.indexOf(editorHints[h]) !== -1) { isEditor = true; break; }
                        }
                        if (!isEditor) continue;

                        try { mod = req(id); } catch(e) { continue; }
                    }

                    if (!mod) continue;
                    apiSelf._matchEditorExports(mod, editors);

                    if (editors.metadata && editors.identifier && editors.image && editors.subtitle) break;
                }

                window.__moonfin_editors = editors;
                var found = Object.keys(editors);
                console.log('[Moonfin] Found editor modules:', found.join(', ') || 'none');
                resolve(found.length > 0);
            }).catch(function(e) {
                console.error('[Moonfin] Error loading editor chunks:', e);
                resolve(false);
            });
        });

        // Allow retry on failure
        this._editorModulesPromise.then(function(success) {
            if (!success) apiSelf._editorModulesPromise = null;
        });

        return this._editorModulesPromise;
    },

    _matchEditorExports: function(mod, editors) {
        if (!mod) return;
        var d = mod.default || mod;

        // metadataEditor: default export with show() + embed() — unique shape
        if (!editors.metadata && d && typeof d.show === 'function' && typeof d.embed === 'function') {
            editors.metadata = d;
            return;
        }

        // itemIdentifier: named exports show() + showFindNew() — unique shape
        if (!editors.identifier && typeof mod.show === 'function' && typeof mod.showFindNew === 'function') {
            editors.identifier = mod;
            return;
        }

        // imageeditor: named export show(options), length <= 1, no showFindNew/embed
        if (!editors.image && typeof mod.show === 'function' && !mod.showFindNew &&
            !(d && typeof d.embed === 'function') && mod.show.length <= 1 &&
            mod !== (editors.identifier || null)) {
            editors.image = mod;
            return;
        }

        // subtitleeditor: default export with show(itemId, serverId), no embed
        if (!editors.subtitle && d && d !== mod && typeof d.show === 'function' &&
            !d.embed && d.show.length >= 2) {
            editors.subtitle = d;
            return;
        }
    },

    openMetadataEditor: function(itemId) {
        var serverId = this.getServerId();
        return this._loadEditorModules().then(function(loaded) {
            var ed = window.__moonfin_editors && window.__moonfin_editors.metadata;
            if (!ed) return false;
            ed.show(itemId, serverId);
            return true;
        }).catch(function(e) {
            console.warn('[Moonfin] Failed to open metadata editor:', e);
            return false;
        });
    },

    openImageEditor: function(itemId) {
        var serverId = this.getServerId();
        return this._loadEditorModules().then(function(loaded) {
            var ed = window.__moonfin_editors && window.__moonfin_editors.image;
            if (!ed) return false;
            var showFn = ed.show || (ed.default && ed.default.show);
            if (!showFn) return false;
            showFn({ itemId: itemId, serverId: serverId });
            return true;
        }).catch(function(e) {
            console.warn('[Moonfin] Failed to open image editor:', e);
            return false;
        });
    },

    openSubtitleEditor: function(itemId) {
        var serverId = this.getServerId();
        return this._loadEditorModules().then(function(loaded) {
            var ed = window.__moonfin_editors && window.__moonfin_editors.subtitle;
            if (!ed) return false;
            ed.show(itemId, serverId);
            return true;
        }).catch(function(e) {
            console.warn('[Moonfin] Failed to open subtitle editor:', e);
            return false;
        });
    },

    openItemIdentifier: function(itemId) {
        var serverId = this.getServerId();
        return this._loadEditorModules().then(function(loaded) {
            var ed = window.__moonfin_editors && window.__moonfin_editors.identifier;
            if (!ed) return false;
            ed.show(itemId, serverId);
            return true;
        }).catch(function(e) {
            console.warn('[Moonfin] Failed to open item identifier:', e);
            return false;
        });
    },

    _playbackManager: null,

    getPlaybackManager: function() {
        if (this._playbackManager) return this._playbackManager;
        if (!this._initWebpackRequire()) return null;

        var req = window.__moonfin_wp_require;
        var cache = req.c || {};
        var factories = req.m || {};
        var keys = Object.keys(factories);

        for (var i = 0; i < keys.length; i++) {
            var id = keys[i];
            var mod;

            if (cache[id]) {
                mod = cache[id].exports;
            } else {
                var src;
                try { src = factories[id].toString(); } catch(e) { continue; }
                if (src.indexOf('playRequestToPlayer') === -1) continue;
                try { mod = req(id); } catch(e) { continue; }
            }

            if (!mod) continue;
            var pm = mod.playbackManager || (mod.default && mod.default.playbackManager);
            if (!pm && mod.default && typeof mod.default.play === 'function' && typeof mod.default.stop === 'function' && typeof mod.default.seek === 'function') {
                pm = mod.default;
            }
            if (pm && typeof pm.play === 'function') {
                this._playbackManager = pm;
                return pm;
            }
        }
        return null;
    }
};


// === utils/storage.js ===
const Storage = {
    STORAGE_KEY: 'moonfin_settings',
    PROFILES_KEY: 'moonfin_profiles',
    SNAPSHOT_KEY: 'moonfin_sync_snapshot',
    SYNC_PREF_KEY: 'moonfin_sync_enabled',
    USER_ID_KEY: 'moonfin_userId',
    CLIENT_ID: 'moonfin-web',
    INITIAL_SYNC_TIMEOUT_MS: 1500,

    syncState: {
        serverAvailable: null,
        lastSyncTime: null,
        lastSyncError: null,
        syncing: false,
        mdblistAvailable: false,
        tmdbAvailable: false,
        adminDefaults: null
    },

    _initialSyncDone: false,
    _initialSyncPromise: null,

    defaults: {
        navbarEnabled: false,
        detailsPageEnabled: false,
        libraryPageEnabled: true,
        detailsBackdropOpacity: 90,
        detailsBackdropBlur: 0,

        mediaBarEnabled: false,
        mediaBarItemCount: 10,
        mediaBarOpacity: 50,
        mediaBarOverlayColor: 'gray',
        mediaBarAutoAdvance: true,
        mediaBarIntervalMs: 7000,
        mediaBarTrailerPreview: true,
        mediaBarSourceType: 'library',
        mediaBarCollectionIds: [],
        mediaBarLibraryIds: [],
        mediaBarExcludedGenres: [],

        showShuffleButton: true,
        showGenresButton: true,
        showFavoritesButton: true,
        showCastButton: true,
        showSyncPlayButton: true,
        showLibrariesInToolbar: true,
        shuffleContentType: 'both',

        seasonalSurprise: 'none',
        backdropEnabled: true,
        confirmExit: true,

        navbarPosition: 'top',
        showClock: true,
        use24HourClock: false,

        mdblistEnabled: false,
        mdblistApiKey: '',
        mdblistRatingSources: ['imdb', 'tmdb', 'tomatoes', 'metacritic'],
        mdblistShowRatingNames: true,

        tmdbApiKey: '',
        tmdbEpisodeRatingsEnabled: false,

        homeRowOrder: ['smalllibrarytiles', 'resume', 'resumeaudio', 'resumebook', 'livetv', 'nextup', 'latestmedia'],
        homeRowsV2: null,
        homeRowsSource: null
    },

    colorOptions: {
        'gray': { name: 'Gray', hex: '#808080' },
        'black': { name: 'Black', hex: '#000000' },
        'dark_blue': { name: 'Dark Blue', hex: '#1A2332' },
        'purple': { name: 'Purple', hex: '#4A148C' },
        'teal': { name: 'Teal', hex: '#00695C' },
        'navy': { name: 'Navy', hex: '#0D1B2A' },
        'charcoal': { name: 'Charcoal', hex: '#36454F' },
        'brown': { name: 'Brown', hex: '#3E2723' },
        'dark_red': { name: 'Dark Red', hex: '#8B0000' },
        'dark_green': { name: 'Dark Green', hex: '#0B4F0F' },
        'slate': { name: 'Slate', hex: '#475569' },
        'indigo': { name: 'Indigo', hex: '#1E3A8A' }
    },

    seasonalOptions: {
        'none': { name: 'None' },
        'winter': { name: 'Winter' },
        'spring': { name: 'Spring' },
        'summer': { name: 'Summer' },
        'fall': { name: 'Fall' },
        'halloween': { name: 'Halloween' }
    },

    // ─── Profile Storage ────────────────────────────────────────────

    getProfiles() {
        try {
            const stored = localStorage.getItem(this.PROFILES_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('[Moonfin] Failed to read profiles:', e);
        }
        return {};
    },

    getProfile(profileName) {
        const profiles = this.getProfiles();
        return profiles[profileName] || {};
    },

    saveProfile(profileName, settings, syncToServer = true) {
        try {
            const profiles = this.getProfiles();
            profiles[profileName] = settings;
            const normalizedProfiles = this._normalizeProfilesForInheritance(profiles);
            localStorage.setItem(this.PROFILES_KEY, JSON.stringify(normalizedProfiles));

            const dispatchChange = () => {
                window.dispatchEvent(new CustomEvent('moonfin-settings-changed', { detail: this.getAll() }));
            };

            if (syncToServer && this.syncState.serverAvailable && this.isSyncEnabled()) {
                const syncPromise = profileName === 'global'
                    ? this.saveAllProfilesToServer(normalizedProfiles)
                    : this.saveProfileToServer(profileName, settings);

                syncPromise.then(dispatchChange);
            } else {
                dispatchChange();
            }
        } catch (e) {
            console.error('[Moonfin] Failed to save profile:', e);
        }
    },

    deleteProfile(profileName) {
        if (profileName === 'global') return;
        const profiles = this.getProfiles();
        delete profiles[profileName];
        localStorage.setItem(this.PROFILES_KEY, JSON.stringify(profiles));

        if (this.syncState.serverAvailable && this.isSyncEnabled()) {
            this.deleteProfileFromServer(profileName);
        }
    },

    // ─── Resolution Chain ───────────────────────────────────────────

    /**
     * Gets resolved flat settings for the current device.
     * Resolution: device profile → global → admin defaults → built-in defaults.
     */
    getAll(profileOverride) {
        const deviceProfile = profileOverride || Device.getProfileName();
        return this.resolveSettings(deviceProfile);
    },

    resolveSettings(profileName) {
        const profiles = this.getProfiles();
        const global = profiles.global || {};
        const device = (profileName !== 'global') ? (profiles[profileName] || {}) : {};
        const adminDefaults = this.syncState.adminDefaults || {};

        const resolved = {};
        const allKeys = Object.keys(this.defaults);

        for (const key of allKeys) {
            // Resolution chain: device → global → admin defaults → built-in
            if (device[key] !== undefined && device[key] !== null) {
                resolved[key] = device[key];
            } else if (global[key] !== undefined && global[key] !== null) {
                resolved[key] = global[key];
            } else if (adminDefaults[key] !== undefined && adminDefaults[key] !== null) {
                resolved[key] = adminDefaults[key];
            } else {
                resolved[key] = this.defaults[key];
            }
        }

        return resolved;
    },

    get(key, defaultValue = null) {
        const settings = this.getAll();
        return key in settings ? settings[key] : (defaultValue !== null ? defaultValue : this.defaults[key]);
    },

    set(key, value, profileName) {
        profileName = profileName || this._activeEditProfile || 'global';
        const profile = this.getProfile(profileName);
        profile[key] = value;
        this.saveProfile(profileName, profile);
    },

    saveAll(settings, syncToServer = true) {
        this.saveProfile('global', settings, syncToServer);
    },

    reset(profileName) {
        if (profileName && profileName !== 'global') {
            this.deleteProfile(profileName);
        } else {
            // Reset all profiles
            localStorage.removeItem(this.PROFILES_KEY);
            localStorage.removeItem(this.SNAPSHOT_KEY);
            if (this.syncState.serverAvailable && this.isSyncEnabled()) {
                this.saveAllProfilesToServer({});
            }
        }
    },

    // ─── Active Edit Profile ────────────────────────────────────────

    _activeEditProfile: 'global',

    setActiveEditProfile(profileName) {
        this._activeEditProfile = profileName;
    },

    getActiveEditProfile() {
        return this._activeEditProfile;
    },

    // ─── Sync Preference ────────────────────────────────────────────

    isSyncEnabled() {
        try {
            const val = localStorage.getItem(this.SYNC_PREF_KEY);
            return val === null ? true : val === 'true';
        } catch (e) {
            return true;
        }
    },

    setSyncEnabled(enabled) {
        localStorage.setItem(this.SYNC_PREF_KEY, String(enabled));
    },

    // ─── Backward Compatibility ─────────────────────────────────────

    _migrateFromLegacy() {
        try {
            const legacy = localStorage.getItem(this.STORAGE_KEY);
            const profiles = localStorage.getItem(this.PROFILES_KEY);

            if (legacy && !profiles) {
                const legacySettings = JSON.parse(legacy);
                console.log('[Moonfin] Migrating legacy settings to profile format');
                this.saveProfile('global', legacySettings, false);
                // Keep the legacy key around for one session as backup
                localStorage.setItem(this.STORAGE_KEY + '_backup', legacy);
                localStorage.removeItem(this.STORAGE_KEY);
            }
        } catch (e) {
            console.error('[Moonfin] Legacy migration failed:', e);
        }
    },

    // ─── Color Helpers ──────────────────────────────────────────────

    getColorHex(colorKey) {
        return this.colorOptions[colorKey]?.hex || this.colorOptions['gray'].hex;
    },

    getColorRgba(colorKey, opacity = 50) {
        const hex = this.getColorHex(colorKey);
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
    },

    // ─── Server Communication ───────────────────────────────────────

    async pingServer() {
        var timeoutId = null;
        var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        try {
            const serverUrl = window.ApiClient?.serverAddress?.() || '';
            if (controller) {
                timeoutId = setTimeout(function() {
                    controller.abort();
                }, Storage.INITIAL_SYNC_TIMEOUT_MS);
            }
            const response = await fetch(`${serverUrl}/Moonfin/Ping`, {
                method: 'GET',
                headers: this.getAuthHeader(),
                signal: controller ? controller.signal : undefined
            });

            if (response.ok) {
                const data = API.toCamelCase(await response.json());
                this.syncState.serverAvailable = data.installed && data.settingsSyncEnabled;
                this.syncState.mdblistAvailable = data.mdblistAvailable || false;
                this.syncState.tmdbAvailable = data.tmdbAvailable || false;

                // Store admin defaults for the resolution chain
                if (data.defaultSettings) {
                    this.syncState.adminDefaults = this._mapProfileFromServer(data.defaultSettings);
                }

                console.log('[Moonfin] Server plugin detected:', data);
                return data;
            }
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
        
        this.syncState.serverAvailable = false;
        return null;
    },

    getAuthHeader() {
        const token = window.ApiClient?.accessToken?.();
        if (token) {
            return { 'Authorization': `MediaBrowser Token="${token}"` };
        }
        return {};
    },

    async fetchFromServer() {
        if (this.syncState.serverAvailable === false) {
            return null;
        }

        try {
            const serverUrl = window.ApiClient?.serverAddress?.() || '';
            const response = await fetch(`${serverUrl}/Moonfin/Settings`, {
                method: 'GET',
                headers: this.getAuthHeader()
            });

            if (response.ok) {
                const serverData = API.toCamelCase(await response.json());
                console.log('[Moonfin] Fetched settings from server');
                return this._mapEnvelopeFromServer(serverData);
            } else if (response.status === 404) {
                console.log('[Moonfin] No settings found on server');
                return null;
            }
        } catch (e) {
            console.error('[Moonfin] Failed to fetch from server:', e);
            this.syncState.lastSyncError = e.message;
        }
        
        return null;
    },

    async saveAllProfilesToServer(profiles) {
        if (this.syncState.serverAvailable === false || !this.isSyncEnabled()) {
            return false;
        }

        try {
            this.syncState.syncing = true;
            const serverUrl = window.ApiClient?.serverAddress?.() || '';
            profiles = this._normalizeProfilesForInheritance(profiles || {});
            
            const envelope = this._mapEnvelopeToServer(profiles);
            envelope.syncEnabled = this.isSyncEnabled();

            const response = await fetch(`${serverUrl}/Moonfin/Settings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                },
                body: JSON.stringify({
                    settings: envelope,
                    clientId: this.CLIENT_ID,
                    mergeMode: 'replace'
                })
            });

            if (response.ok) {
                this.syncState.lastSyncTime = Date.now();
                this.syncState.lastSyncError = null;
                return true;
            }
        } catch (e) {
            console.error('[Moonfin] Failed to save to server:', e);
            this.syncState.lastSyncError = e.message;
        } finally {
            this.syncState.syncing = false;
        }
        
        return false;
    },

    _normalizeProfilesForInheritance(profiles) {
        const normalized = {};
        const global = (profiles && profiles.global && typeof profiles.global === 'object')
            ? profiles.global
            : null;

        const profileNames = Object.keys(profiles || {});
        for (let i = 0; i < profileNames.length; i++) {
            const name = profileNames[i];
            const input = profiles[name];

            if (!input || typeof input !== 'object') continue;

            if (name === 'global' || !global || (name !== 'desktop' && name !== 'mobile' && name !== 'tv')) {
                normalized[name] = { ...input };
                continue;
            }

            const cleaned = {};
            const keys = Object.keys(input);
            for (let k = 0; k < keys.length; k++) {
                const key = keys[k];
                const value = input[key];
                if (value === undefined || value === null) continue;

                if (global[key] !== undefined && this._deepEqual(value, global[key])) {
                    continue;
                }

                cleaned[key] = value;
            }

            if (Object.keys(cleaned).length > 0) {
                normalized[name] = cleaned;
            }
        }

        return normalized;
    },

    async saveProfileToServer(profileName, profileSettings) {
        if (this.syncState.serverAvailable === false || !this.isSyncEnabled()) {
            return false;
        }

        try {
            this.syncState.syncing = true;
            const serverUrl = window.ApiClient?.serverAddress?.() || '';
            const serverProfile = this._mapProfileToServer(profileSettings);
            
            const response = await fetch(`${serverUrl}/Moonfin/Settings/Profile/${profileName}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...this.getAuthHeader()
                },
                body: JSON.stringify({
                    profile: serverProfile,
                    clientId: this.CLIENT_ID
                })
            });

            if (response.ok) {
                this.syncState.lastSyncTime = Date.now();
                this.syncState.lastSyncError = null;
                console.log('[Moonfin] Profile "' + profileName + '" saved to server');
                return true;
            }
        } catch (e) {
            console.error('[Moonfin] Failed to save profile to server:', e);
            this.syncState.lastSyncError = e.message;
        } finally {
            this.syncState.syncing = false;
        }
        
        return false;
    },

    async deleteProfileFromServer(profileName) {
        if (this.syncState.serverAvailable === false || !this.isSyncEnabled()) {
            return false;
        }

        try {
            const serverUrl = window.ApiClient?.serverAddress?.() || '';
            await fetch(`${serverUrl}/Moonfin/Settings/Profile/${profileName}`, {
                method: 'DELETE',
                headers: this.getAuthHeader()
            });
        } catch (e) {
            console.error('[Moonfin] Failed to delete profile from server:', e);
        }

        return false;
    },


    // ─── Server ↔ Local Mapping ─────────────────────────────────────

    _mapProfileFromServer(serverProfile) {
        if (!serverProfile) return {};
        var mapping = {
            desktopMediaBarProvider: 'desktopMediaBarProvider',
            navbarEnabled: 'navbarEnabled',
            detailsPageEnabled: 'detailsPageEnabled',
            libraryPageEnabled: 'libraryPageEnabled',
            detailsBackdropOpacity: 'detailsBackdropOpacity',
            detailsBackdropBlur: 'detailsBackdropBlur',
            mediaBarEnabled: 'mediaBarEnabled',
            mediaBarItemCount: 'mediaBarItemCount',
            mediaBarOpacity: 'mediaBarOpacity',
            mediaBarOverlayColor: 'mediaBarOverlayColor',
            mediaBarAutoAdvance: 'mediaBarAutoAdvance',
            mediaBarIntervalMs: 'mediaBarIntervalMs',
            mediaBarTrailerPreview: 'mediaBarTrailerPreview',
            mediaBarSourceType: 'mediaBarSourceType',
            mediaBarCollectionIds: 'mediaBarCollectionIds',
            mediaBarLibraryIds: 'mediaBarLibraryIds',
            mediaBarExcludedGenres: 'mediaBarExcludedGenres',
            showShuffleButton: 'showShuffleButton',
            showGenresButton: 'showGenresButton',
            showFavoritesButton: 'showFavoritesButton',
            showCastButton: 'showCastButton',
            showSyncPlayButton: 'showSyncPlayButton',
            showLibrariesInToolbar: 'showLibrariesInToolbar',
            shuffleContentType: 'shuffleContentType',
            seasonalSurprise: 'seasonalSurprise',
            backdropEnabled: 'backdropEnabled',
            confirmExit: 'confirmExit',
            navbarPosition: 'navbarPosition',
            showClock: 'showClock',
            use24HourClock: 'use24HourClock',
            mdblistEnabled: 'mdblistEnabled',
            mdblistApiKey: 'mdblistApiKey',
            mdblistRatingSources: 'mdblistRatingSources',
            mdblistShowRatingNames: 'mdblistShowRatingNames',
            tmdbApiKey: 'tmdbApiKey',
            tmdbEpisodeRatingsEnabled: 'tmdbEpisodeRatingsEnabled',
            homeRowOrder: 'homeRowOrder',
            homeRowsV2: 'homeRowsV2',
            homeRowsSource: 'homeRowsSource'
        };
        // Only include properties that have actual values — prevents undefined/null
        // from polluting merge operations and overwriting valid false values
        var result = {};
        for (var localKey in mapping) {
            var serverKey = mapping[localKey];
            var val = serverProfile[serverKey];
            if (val !== undefined && val !== null) {
                result[localKey] = val;
            }
        }
        return result;
    },

    _mapProfileToServer(localProfile) {
        if (!localProfile) return {};
        return {
            desktopMediaBarProvider: localProfile.desktopMediaBarProvider,
            navbarEnabled: localProfile.navbarEnabled,
            detailsPageEnabled: localProfile.detailsPageEnabled,
            libraryPageEnabled: localProfile.libraryPageEnabled,
            detailsBackdropOpacity: localProfile.detailsBackdropOpacity,
            detailsBackdropBlur: localProfile.detailsBackdropBlur,
            mediaBarEnabled: localProfile.mediaBarEnabled,
            mediaBarItemCount: localProfile.mediaBarItemCount,
            mediaBarOpacity: localProfile.mediaBarOpacity,
            mediaBarOverlayColor: localProfile.mediaBarOverlayColor,
            mediaBarAutoAdvance: localProfile.mediaBarAutoAdvance,
            mediaBarIntervalMs: localProfile.mediaBarIntervalMs,
            mediaBarTrailerPreview: localProfile.mediaBarTrailerPreview,
            mediaBarSourceType: localProfile.mediaBarSourceType,
            mediaBarCollectionIds: localProfile.mediaBarCollectionIds,
            mediaBarLibraryIds: localProfile.mediaBarLibraryIds,
            mediaBarExcludedGenres: localProfile.mediaBarExcludedGenres,
            showShuffleButton: localProfile.showShuffleButton,
            showGenresButton: localProfile.showGenresButton,
            showFavoritesButton: localProfile.showFavoritesButton,
            showCastButton: localProfile.showCastButton,
            showSyncPlayButton: localProfile.showSyncPlayButton,
            showLibrariesInToolbar: localProfile.showLibrariesInToolbar,
            shuffleContentType: localProfile.shuffleContentType,
            seasonalSurprise: localProfile.seasonalSurprise,
            backdropEnabled: localProfile.backdropEnabled,
            confirmExit: localProfile.confirmExit,
            navbarPosition: localProfile.navbarPosition,
            showClock: localProfile.showClock,
            use24HourClock: localProfile.use24HourClock,
            mdblistEnabled: localProfile.mdblistEnabled,
            mdblistApiKey: localProfile.mdblistApiKey,
            mdblistRatingSources: localProfile.mdblistRatingSources,
            mdblistShowRatingNames: localProfile.mdblistShowRatingNames,
            tmdbApiKey: localProfile.tmdbApiKey,
            tmdbEpisodeRatingsEnabled: localProfile.tmdbEpisodeRatingsEnabled,
            homeRowOrder: localProfile.homeRowOrder,
            homeRowsV2: localProfile.homeRowsV2,
            homeRowsSource: localProfile.homeRowsSource
        };
    },

    /**
     * Maps server envelope (v2) to local profiles object.
     * Also handles v1 legacy format from the server.
     */
    _mapEnvelopeFromServer(serverData) {
        // v2 profiled format
        if (serverData.global || serverData.desktop || serverData.mobile || serverData.tv) {
            const profiles = {};
            if (serverData.global) profiles.global = this._mapProfileFromServer(serverData.global);
            if (serverData.desktop) profiles.desktop = this._mapProfileFromServer(serverData.desktop);
            if (serverData.mobile) profiles.mobile = this._mapProfileFromServer(serverData.mobile);
            if (serverData.tv) profiles.tv = this._mapProfileFromServer(serverData.tv);
            return {
                profiles: profiles,
                syncEnabled: serverData.syncEnabled !== false
            };
        }

        // v1 legacy flat format — treat as global
        const mapped = this._mapProfileFromServer(serverData);
        return {
            profiles: { global: mapped },
            syncEnabled: true
        };
    },

    _mapEnvelopeToServer(profiles) {
        const envelope = { schemaVersion: 2 };
        if (profiles.global) envelope.global = this._mapProfileToServer(profiles.global);
        if (profiles.desktop) envelope.desktop = this._mapProfileToServer(profiles.desktop);
        if (profiles.mobile) envelope.mobile = this._mapProfileToServer(profiles.mobile);
        if (profiles.tv) envelope.tv = this._mapProfileToServer(profiles.tv);
        return envelope;
    },

    // ─── Sync Snapshots ─────────────────────────────────────────────

    getSnapshot() {
        try {
            const stored = localStorage.getItem(this.SNAPSHOT_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('[Moonfin] Failed to read sync snapshot:', e);
        }
        return null;
    },

    saveSnapshot(profiles) {
        try {
            localStorage.setItem(this.SNAPSHOT_KEY, JSON.stringify(profiles));
        } catch (e) {
            console.error('[Moonfin] Failed to save sync snapshot:', e);
        }
    },

    // ─── Three-Way Merge ────────────────────────────────────────────

    threeWayMergeProfiles(localProfiles, serverProfiles, snapshotProfiles) {
        const merged = {};
        const allProfileNames = new Set([
            ...Object.keys(localProfiles || {}),
            ...Object.keys(serverProfiles || {}),
            ...Object.keys(snapshotProfiles || {})
        ]);

        for (const name of allProfileNames) {
            merged[name] = this._threeWayMergeFlat(
                localProfiles[name] || {},
                serverProfiles[name] || {},
                snapshotProfiles[name] || {}
            );
        }

        return merged;
    },

    _threeWayMergeFlat(local, server, snapshot) {
        const merged = {};
        const allKeys = new Set([...Object.keys(local), ...Object.keys(server), ...Object.keys(this.defaults)]);

        for (const key of allKeys) {
            const localVal = local[key];
            const serverVal = server[key];
            const snapVal = snapshot[key];

            const localChanged = !this._deepEqual(localVal, snapVal);
            const serverChanged = !this._deepEqual(serverVal, snapVal);

            if (localChanged && !serverChanged) {
                if (localVal !== undefined) merged[key] = localVal;
            } else if (serverChanged && !localChanged) {
                if (serverVal !== undefined) merged[key] = serverVal;
                else if (localVal !== undefined) merged[key] = localVal;
            } else if (localChanged && serverChanged) {
                if (localVal !== undefined) merged[key] = localVal;
            } else {
                if (localVal !== undefined) merged[key] = localVal;
            }
        }

        return merged;
    },

    _deepEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return a == b;
        if (Array.isArray(a) && Array.isArray(b)) {
            if (a.length !== b.length) return false;
            for (let i = 0; i < a.length; i++) {
                if (!this._deepEqual(a[i], b[i])) return false;
            }
            return true;
        }
        if (typeof a === 'object' && typeof b === 'object') {
            const ka = Object.keys(a), kb = Object.keys(b);
            if (ka.length !== kb.length) return false;
            for (const k of ka) {
                if (!this._deepEqual(a[k], b[k])) return false;
            }
            return true;
        }
        return false;
    },

    // ─── Full Sync ──────────────────────────────────────────────────

    async sync(forceFromServer = false) {
        console.log('[Moonfin] Starting settings sync...' + (forceFromServer ? ' (server wins)' : ''));
        
        const pingResult = await this.pingServer();
        if (!pingResult?.installed || !pingResult?.settingsSyncEnabled) {
            console.log('[Moonfin] Server sync not available');
            return;
        }

        if (!this.isSyncEnabled()) {
            console.log('[Moonfin] User has disabled sync');
            return;
        }

        const localProfiles = this.getProfiles();
        const hasLocalProfiles = Object.keys(localProfiles).length > 0;
        const serverResult = await this.fetchFromServer();
        const serverProfiles = serverResult?.profiles || null;
        const snapshot = this.getSnapshot();

        let merged;

        if (forceFromServer && serverProfiles) {
            merged = this._normalizeProfilesForInheritance(serverProfiles);
        } else if (serverProfiles && hasLocalProfiles && snapshot) {
            merged = this.threeWayMergeProfiles(localProfiles, serverProfiles, snapshot);
        } else if (serverProfiles && hasLocalProfiles && !snapshot) {
            // First sync — local wins for conflicts
            merged = {};
            const allNames = new Set([...Object.keys(serverProfiles), ...Object.keys(localProfiles)]);
            for (const name of allNames) {
                merged[name] = { ...(serverProfiles[name] || {}), ...(localProfiles[name] || {}) };
            }
        } else if (serverProfiles && !hasLocalProfiles) {
            merged = serverProfiles;
        } else if (hasLocalProfiles) {
            merged = localProfiles;
        } else {
            const adminDefaults = this.syncState.adminDefaults;
            if (adminDefaults && Object.keys(adminDefaults).length > 0) {
                window.dispatchEvent(new CustomEvent('moonfin-settings-changed', { detail: this.getAll() }));
            }
            return;
        }

        merged = this._normalizeProfilesForInheritance(merged);

        // Update local state
        try {
            localStorage.setItem(this.PROFILES_KEY, JSON.stringify(merged));
            window.dispatchEvent(new CustomEvent('moonfin-settings-changed', { detail: this.getAll() }));
        } catch (e) {
            console.error('[Moonfin] Failed to save merged profiles:', e);
        }

        // Update sync preference from server if available
        if (serverResult && serverResult.syncEnabled !== undefined) {
            this.setSyncEnabled(serverResult.syncEnabled);
        }

        await this.saveAllProfilesToServer(merged);
        this.saveSnapshot(merged);
    },

    _runInitialSync() {
        return this.sync().catch(function(e) {
            console.warn('[Moonfin] Initial sync failed:', e && e.message ? e.message : e);
        }).finally(() => {
            this._initialSyncPromise = null;
        });
    },

    async initSync() {
        if (this._initialSyncPromise) return this._initialSyncPromise;
        if (this._initialSyncDone) return Promise.resolve();

        this._initialSyncDone = true;

        // Migrate legacy flat settings
        this._migrateFromLegacy();

        if (window.ApiClient?.isLoggedIn?.()) {
            this._initialSyncPromise = this._runInitialSync();
            return this._initialSyncPromise;
        }

        const onLogin = () => {
            if (!window.ApiClient?.isLoggedIn?.()) return;
            document.removeEventListener('viewshow', onLogin);
            if (!this._initialSyncPromise) {
                this._initialSyncPromise = this._runInitialSync();
            }
        };
        document.addEventListener('viewshow', onLogin);

        return Promise.resolve();
    },

    getSyncStatus() {
        return {
            available: this.syncState.serverAvailable,
            lastSync: this.syncState.lastSyncTime,
            error: this.syncState.lastSyncError,
            syncing: this.syncState.syncing
        };
    },

    resetForNewUser() {
        localStorage.removeItem(this.PROFILES_KEY);
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.SNAPSHOT_KEY);
        localStorage.removeItem(this.USER_ID_KEY);
        this._initialSyncDone = false;
        this._initialSyncPromise = null;
        this._activeEditProfile = 'global';
        this.syncState.serverAvailable = null;
        this.syncState.lastSyncTime = null;
        this.syncState.lastSyncError = null;
        this.syncState.syncing = false;
        this.syncState.mdblistAvailable = false;
        this.syncState.tmdbAvailable = false;
        this.syncState.adminDefaults = null;
    },

    checkUserOwnership(currentUserId) {
        if (!currentUserId) return;
        const storedUserId = localStorage.getItem(this.USER_ID_KEY);
        if (storedUserId && storedUserId !== currentUserId) {
            localStorage.removeItem(this.SNAPSHOT_KEY);
            this._initialSyncDone = false;
            this._initialSyncPromise = null;
            this.syncState.serverAvailable = null;
            this.syncState.lastSyncTime = null;
            this.syncState.lastSyncError = null;
            this.syncState.syncing = false;
            this.syncState.adminDefaults = null;
        }
        localStorage.setItem(this.USER_ID_KEY, currentUserId);
    }
};


// === utils/mdblist.js ===
var MdbList = {
    _cache: {},
    _cacheTtlMs: 30 * 60 * 1000,

    init: function() {
        var self = this;
        window.addEventListener('moonfin-settings-changed', function() {
            self.clearCache();
        });
    },

    // Rating source metadata with icon filenames served from Moonfin/Assets/
    sources: {
        imdb:           { name: 'IMDb',            iconFile: 'imdb.svg',            color: '#F5C518', textColor: '#000' },
        tmdb:           { name: 'TMDb',            iconFile: 'tmdb.svg',            color: '#01D277', textColor: '#fff' },
        trakt:          { name: 'Trakt',           iconFile: 'trakt.svg',           color: '#ED1C24', textColor: '#fff' },
        tomatoes:       { name: 'Rotten Tomatoes', iconFile: 'rt-fresh.svg',        color: '#FA320A', textColor: '#fff' },
        popcorn:        { name: 'RT Audience',     iconFile: 'rt-audience-up.svg',  color: '#FA320A', textColor: '#fff' },
        metacritic:     { name: 'Metacritic',      iconFile: 'metacritic.svg',      color: '#FFCC34', textColor: '#000' },
        metacriticuser: { name: 'Metacritic User', iconFile: 'metacritic-user.svg', color: '#00CE7A', textColor: '#000' },
        letterboxd:     { name: 'Letterboxd',      iconFile: 'letterboxd.svg',      color: '#00E054', textColor: '#fff' },
        rogerebert:     { name: 'RogerEbert',      iconFile: 'rogerebert.svg',      color: '#E50914', textColor: '#fff' },
        myanimelist:    { name: 'MyAnimeList',     iconFile: 'mal.svg',             color: '#2E51A2', textColor: '#fff' },
        anilist:        { name: 'AniList',         iconFile: 'anilist.svg',         color: '#02A9FF', textColor: '#fff' }
    },

    getIconUrl: function(source, rating) {
        var info = this.sources[source];
        if (!info) return '';
        var api = API.getApiClient();
        if (!api) return '';
        var serverUrl = api._serverAddress || '';

        // Special icon variants based on score
        var score = rating ? rating.score : null;

        // Rotten Tomatoes tomatometer: Certified Fresh >= 75, Fresh >= 60, Rotten < 60
        if (source === 'tomatoes' && score != null && score > 0) {
            if (score >= 75) return serverUrl + '/Moonfin/Assets/rt-certified.svg';
            if (score < 60) return serverUrl + '/Moonfin/Assets/rt-rotten.svg';
        }

        // RT Audience: Verified Hot >= 90, upright popcorn >= 60, spilled < 60
        if (source === 'popcorn' && score != null && score > 0) {
            if (score >= 90) return serverUrl + '/Moonfin/Assets/rt-verified.svg';
            if (score < 60) return serverUrl + '/Moonfin/Assets/rt-audience-down.svg';
        }

        // Metacritic: Must-play/Must-see badge >= 81
        if (source === 'metacritic' && score != null && score >= 81) {
            return serverUrl + '/Moonfin/Assets/metacritic-score.svg';
        }

        return serverUrl + '/Moonfin/Assets/' + info.iconFile;
    },

    isEnabled: function() {
        var settings = Storage.getAll();
        return settings.mdblistEnabled === true;
    },

    // Returns 'movie' or 'show', or null if unsupported
    getContentType: function(item) {
        if (!item) return null;
        var type = item.Type || item.type;
        if (type === 'Movie') return 'movie';
        if (type === 'Series') return 'show';
        // Episodes and Seasons map to their parent series
        if (type === 'Episode' || type === 'Season') return 'show';
        return null;
    },

    getTmdbId: function(item) {
        if (!item) return null;
        var providerIds = item.ProviderIds || item.providerIds;
        if (!providerIds) return null;
        return providerIds.Tmdb || providerIds.tmdb || null;
    },

    fetchRatings: function(item) {
        if (!this.isEnabled()) return Promise.resolve([]);

        var contentType = this.getContentType(item);
        var tmdbId = this.getTmdbId(item);

        if (!contentType || !tmdbId) return Promise.resolve([]);

        return this.fetchRatingsByTmdb(contentType, tmdbId);
    },

    fetchRatingsByTmdb: function(type, tmdbId) {
        var self = this;
        var cacheKey = type + ':' + tmdbId;

        // Check client cache
        var cached = this._cache[cacheKey];
        if (cached && (Date.now() - cached.fetchedAt) < this._cacheTtlMs) {
            return Promise.resolve(cached.ratings);
        }

        var api = API.getApiClient();
        if (!api) return Promise.resolve([]);

        var url = api.getUrl('Moonfin/MdbList/Ratings', {
            type: type,
            tmdbId: tmdbId
        });

        return new Promise(function(resolve) {
            api.ajax({
                type: 'GET',
                url: url,
                dataType: 'json',
                headers: {
                    'Authorization': 'MediaBrowser Token="' + api.accessToken() + '"'
                }
            }).then(function(response) {
                var resp = API.toCamelCase(response);
                if (resp && resp.success && resp.ratings) {
                    // Normalize rating keys
                    var ratings = [];
                    for (var i = 0; i < resp.ratings.length; i++) {
                        ratings.push(API.toCamelCase(resp.ratings[i]));
                    }
                    self._cache[cacheKey] = { ratings: ratings, fetchedAt: Date.now() };
                    resolve(ratings);
                } else {
                    if (resp && resp.error) {
                        console.warn('[Moonfin] MDBList:', resp.error);
                    }
                    resolve([]);
                }
            }, function(err) {
                console.warn('[Moonfin] MDBList fetch failed:', err);
                resolve([]);
            });
        });
    },

    // MDBList returns `value` (native scale) and `score` (0-100 normalized)
    formatRating: function(rating) {
        if (!rating || !rating.source) return null;
        var source = rating.source.toLowerCase();
        var value = rating.value;
        var score = rating.score;

        if (value == null && score == null) return null;

        // Use native value when available for better display
        switch (source) {
            case 'imdb':
                // IMDb: 0-10 scale
                return value != null ? value.toFixed(1) : (score != null ? (score / 10).toFixed(1) : null);
            case 'tmdb':
                // TMDb: 0-10 scale
                return value != null ? value.toFixed(0) + '%' : (score != null ? score.toFixed(0) + '%' : null);
            case 'tomatoes':
            case 'popcorn':
            case 'metacritic':
            case 'metacriticuser':
                // Percentage-based
                return score != null ? score.toFixed(0) + '%' : (value != null ? value.toFixed(0) + '%' : null);
            case 'letterboxd': {
                // Letterboxd: always derive from normalized score (0-100) / 20 to avoid value scale ambiguity.
                return score != null ? (score / 20).toFixed(1) + '/5' : null;
            }
            case 'trakt':
                // Trakt: percentage
                return score != null ? score.toFixed(0) + '%' : null;
            case 'rogerebert':
                // Roger Ebert: 0-4 scale (value), score is 0-100
                return value != null ? value.toFixed(1) + '/4' : (score != null ? score.toFixed(0) + '%' : null);
            case 'myanimelist':
                // MAL: 0-10 scale
                return value != null ? value.toFixed(1) : (score != null ? (score / 10).toFixed(1) : null);
            case 'anilist':
                // AniList: percentage
                return score != null ? score.toFixed(0) + '%' : null;
            default:
                return score != null ? score.toFixed(0) + '%' : (value != null ? String(value) : null);
        }
    },

    getSourceInfo: function(source) {
        return this.sources[source] || { name: source, icon: source, color: '#666', textColor: '#fff' };
    },

    clearCache: function() {
        this._cache = {};
    },

    buildRatingsHtml: function(ratings, mode) {
        if (!ratings || ratings.length === 0) return '';

        var settings = Storage.getAll();
        var showNames = settings.mdblistShowRatingNames !== false;
        var html = '';

        for (var i = 0; i < ratings.length; i++) {
            var rating = ratings[i];
            if (!rating || !rating.source) continue;

            var source = rating.source.toLowerCase();
            var formatted = this.formatRating(rating);
            if (!formatted) continue;

            var info = this.getSourceInfo(source);
            var iconUrl = this.getIconUrl(source, rating);

            if (mode === 'compact') {
                html += '<span class="moonfin-mdblist-rating-compact">' +
                    '<img class="moonfin-mdblist-icon" src="' + iconUrl + '" alt="' + info.name + '" title="' + info.name + '" loading="lazy">' +
                    '<span class="moonfin-mdblist-value">' + formatted + '</span>' +
                '</span>';
            } else {
                html += '<div class="moonfin-mdblist-rating-full">' +
                    '<img class="moonfin-mdblist-icon-lg" src="' + iconUrl + '" alt="' + info.name + '" title="' + info.name + '" loading="lazy">' +
                    '<div class="moonfin-mdblist-rating-info">' +
                        '<span class="moonfin-mdblist-rating-value">' + formatted + '</span>' +
                        (showNames ? '<span class="moonfin-mdblist-rating-name">' + info.name + '</span>' : '') +
                    '</div>' +
                '</div>';
            }
        }

        return html;
    }
};


// === utils/tmdb.js ===
var Tmdb = {
    // In-memory cache: key = "tmdbId:season" => { episodes, fetchedAt }
    _seasonCache: {},
    // key = "tmdbId:season:episode" => { rating, fetchedAt }
    _episodeCache: {},
    _cacheTtlMs: 30 * 60 * 1000, // 30 minutes client-side cache

    // Cache resolved series TMDB IDs: jellyfinSeriesId => tmdbSeriesId
    _seriesIdCache: {},

    isEnabled: function() {
        var settings = Storage.getAll();
        return settings.tmdbEpisodeRatingsEnabled === true;
    },

    getIconUrl: function() {
        var api = API.getApiClient();
        if (!api) return '';
        var serverUrl = api._serverAddress || '';
        return serverUrl + '/Moonfin/Assets/tmdb.svg';
    },

    /**
     * Resolve TMDB series ID from a Jellyfin series ID.
     * Episodes have their own TMDB ID in ProviderIds, so we need to
     * fetch the parent series item to get the series-level TMDB ID.
     */
    resolveSeriesTmdbId: function(jellyfinSeriesId) {
        if (!jellyfinSeriesId) return Promise.resolve(null);

        if (this._seriesIdCache[jellyfinSeriesId] !== undefined) {
            return Promise.resolve(this._seriesIdCache[jellyfinSeriesId]);
        }

        var self = this;
        var api = API.getApiClient();
        if (!api) return Promise.resolve(null);

        var userId = api.getCurrentUserId();
        return api.getItem(userId, jellyfinSeriesId).then(function(seriesItem) {
            var providerIds = seriesItem.ProviderIds || seriesItem.providerIds;
            var tmdbId = providerIds ? (providerIds.Tmdb || providerIds.tmdb) : null;
            self._seriesIdCache[jellyfinSeriesId] = tmdbId || null;
            return tmdbId || null;
        }).catch(function(err) {
            console.warn('[Moonfin] TMDB: Failed to resolve series TMDB ID:', err);
            self._seriesIdCache[jellyfinSeriesId] = null;
            return null;
        });
    },

    /**
     * Fetch a single episode rating.
     * Returns a promise resolving to { voteAverage, voteCount, name, ... } or null.
     */
    fetchEpisodeRating: function(tmdbId, season, episode) {
        if (!tmdbId || season == null || episode == null) return Promise.resolve(null);

        var cacheKey = tmdbId + ':' + season + ':' + episode;
        var cached = this._episodeCache[cacheKey];
        if (cached && (Date.now() - cached.fetchedAt) < this._cacheTtlMs) {
            return Promise.resolve(cached.rating);
        }

        var api = API.getApiClient();
        if (!api) return Promise.resolve(null);

        var self = this;
        var url = api.getUrl('Moonfin/Tmdb/EpisodeRating', {
            tmdbId: tmdbId,
            season: season,
            episode: episode
        });

        return new Promise(function(resolve) {
            api.ajax({
                type: 'GET',
                url: url,
                dataType: 'json',
                headers: {
                    'Authorization': 'MediaBrowser Token="' + api.accessToken() + '"'
                }
            }).then(function(response) {
                var resp = API.toCamelCase(response);
                if (resp && resp.success && resp.voteAverage != null) {
                    self._episodeCache[cacheKey] = { rating: resp, fetchedAt: Date.now() };
                    resolve(resp);
                } else {
                    if (resp && resp.error) {
                        console.warn('[Moonfin] TMDB:', resp.error);
                    }
                    resolve(null);
                }
            }, function(err) {
                console.warn('[Moonfin] TMDB episode rating fetch failed:', err);
                resolve(null);
            });
        });
    },

    /**
     * Fetch all episode ratings for a season (bulk).
     * Returns a promise resolving to an array of episode rating objects.
     * Also populates the individual episode cache.
     */
    fetchSeasonRatings: function(tmdbId, season) {
        if (!tmdbId || season == null) return Promise.resolve([]);

        var seasonKey = tmdbId + ':' + season;
        var cached = this._seasonCache[seasonKey];
        if (cached && (Date.now() - cached.fetchedAt) < this._cacheTtlMs) {
            return Promise.resolve(cached.episodes);
        }

        var api = API.getApiClient();
        if (!api) return Promise.resolve([]);

        var self = this;
        var url = api.getUrl('Moonfin/Tmdb/SeasonRatings', {
            tmdbId: tmdbId,
            season: season
        });

        return new Promise(function(resolve) {
            api.ajax({
                type: 'GET',
                url: url,
                dataType: 'json',
                headers: {
                    'Authorization': 'MediaBrowser Token="' + api.accessToken() + '"'
                }
            }).then(function(response) {
                var resp = API.toCamelCase(response);
                if (resp && resp.success && resp.episodes) {
                    var episodes = [];
                    for (var i = 0; i < resp.episodes.length; i++) {
                        var ep = API.toCamelCase(resp.episodes[i]);
                        episodes.push(ep);
                        if (ep.episodeNumber != null) {
                            var epKey = tmdbId + ':' + season + ':' + ep.episodeNumber;
                            self._episodeCache[epKey] = { rating: ep, fetchedAt: Date.now() };
                        }
                    }
                    self._seasonCache[seasonKey] = { episodes: episodes, fetchedAt: Date.now() };
                    resolve(episodes);
                } else {
                    if (resp && resp.error) {
                        console.warn('[Moonfin] TMDB:', resp.error);
                    }
                    resolve([]);
                }
            }, function(err) {
                console.warn('[Moonfin] TMDB season ratings fetch failed:', err);
                resolve([]);
            });
        });
    },

    /**
     * Get the rating for a specific episode from a Jellyfin item.
     * Resolves the TMDB series ID from the parent series item.
     * For efficiency, fetches the whole season and caches it.
     */
    fetchRatingForEpisode: function(item) {
        if (!this.isEnabled()) return Promise.resolve(null);
        if (!item || item.Type !== 'Episode') return Promise.resolve(null);

        var season = item.ParentIndexNumber;
        var episode = item.IndexNumber;
        if (season == null || episode == null) return Promise.resolve(null);

        // We need the parent series' TMDB ID, not the episode's
        var seriesId = item.SeriesId;
        if (!seriesId) return Promise.resolve(null);

        var self = this;
        return this.resolveSeriesTmdbId(seriesId).then(function(tmdbId) {
            if (!tmdbId) return null;

            var cacheKey = tmdbId + ':' + season + ':' + episode;
            var cached = self._episodeCache[cacheKey];
            if (cached && (Date.now() - cached.fetchedAt) < self._cacheTtlMs) {
                return cached.rating;
            }

            return self.fetchSeasonRatings(tmdbId, season).then(function(episodes) {
                for (var i = 0; i < episodes.length; i++) {
                    if (episodes[i].episodeNumber === episode) {
                        return episodes[i];
                    }
                }
                return self.fetchEpisodeRating(tmdbId, season, episode);
            });
        });
    },

    /**
     * Format a TMDB vote_average (0-10) as a display string.
     * Uses TMDB's native format: X.X
     */
    formatRating: function(voteAverage) {
        if (voteAverage == null) return null;
        // Show one decimal place, but drop .0 for whole numbers
        var val = Math.round(voteAverage * 10) / 10;
        return val % 1 === 0 ? val.toFixed(0) : val.toFixed(1);
    },

    /**
     * Build HTML for a single TMDB episode rating pill (matches mdblist style).
     */
    buildRatingHtml: function(rating) {
        if (!rating || rating.voteAverage == null) return '';
        var formatted = this.formatRating(rating.voteAverage);
        if (!formatted) return '';

        var iconUrl = this.getIconUrl();

        return '<div class="moonfin-mdblist-rating-full moonfin-tmdb-episode-rating">' +
            '<img class="moonfin-mdblist-icon-lg" src="' + iconUrl + '" alt="TMDB" title="TMDB Episode Rating" loading="lazy">' +
            '<div class="moonfin-mdblist-rating-info">' +
                '<span class="moonfin-mdblist-rating-value">' + formatted + '<span class="moonfin-tmdb-scale">/10</span></span>' +
                '<span class="moonfin-mdblist-rating-name">Episode</span>' +
            '</div>' +
        '</div>';
    },

    /**
     * Build compact HTML for episode rating (used in episode lists).
     */
    buildCompactRatingHtml: function(rating) {
        if (!rating || rating.voteAverage == null) return '';
        var formatted = this.formatRating(rating.voteAverage);
        if (!formatted) return '';

        var iconUrl = this.getIconUrl();

        return '<span class="moonfin-tmdb-ep-rating-compact">' +
            '<img class="moonfin-mdblist-icon" src="' + iconUrl + '" alt="TMDB" title="TMDB Episode Rating" loading="lazy">' +
            '<span class="moonfin-mdblist-value">' + formatted + '<span class="moonfin-tmdb-scale-sm">/10</span></span>' +
        '</span>';
    }
};


// === utils/tv-navigation.js ===
const TVNavigation = {
    enabled: false,
    focusableSelector: '.moonfin-focusable, .moonfin-nav-btn, .moonfin-user-btn, .moonfin-library-btn, .moonfin-mediabar-nav-btn, .moonfin-mediabar-dot, .moonfin-jellyseerr-fab',
    focusableElements: [],
    
    // Key codes for different TV platforms
    KEYS: {
        LEFT: [37, 'ArrowLeft'],
        RIGHT: [39, 'ArrowRight'],
        UP: [38, 'ArrowUp'],
        DOWN: [40, 'ArrowDown'],
        ENTER: [13, 'Enter'],
        BACK: [461, 10009, 8, 27, 'Escape', 'GoBack'],
    },

    init() {
        if (!this.isTV()) {
            console.log('[Moonfin TV] Not a TV device, skipping TV navigation');
            return;
        }

        console.log('[Moonfin TV] Initializing TV navigation...');
        this.enabled = true;
        
        document.body.classList.add('moonfin-tv-mode');
        
        this.setupKeyboardListeners();
        
        this.setupMutationObserver();
        
        this.updateFocusableElements();
        
        console.log('[Moonfin TV] TV navigation initialized');
    },

    isTV() {
        // Check NativeShell (jellyfin-webos/tizen provides this)
        if (window.NativeShell?.AppHost?.getDefaultLayout?.() === 'tv') {
            return true;
        }
        
        const ua = navigator.userAgent.toLowerCase();
        if (/tv|tizen|webos|smart-tv|netcast|hbbtv|vidaa|viera/i.test(ua)) {
            return true;
        }
        
        // Check Device utility
        if (typeof Device !== 'undefined' && Device.isTV?.()) {
            return true;
        }
        
        return false;
    },

    setupKeyboardListeners() {
        // Use capture phase to intercept events before jellyfin-web handlers
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            const key = e.key || e.keyCode;
            
            const activeEl = document.activeElement;
            const isMoonfinElement = activeEl && (
                activeEl.classList.contains('moonfin-nav-btn') ||
                activeEl.classList.contains('moonfin-user-btn') ||
                activeEl.classList.contains('moonfin-mediabar-nav-btn') ||
                activeEl.classList.contains('moonfin-mediabar-dot') ||
                activeEl.classList.contains('moonfin-focusable') ||
                activeEl.classList.contains('moonfin-focused') ||
                activeEl.classList.contains('moonfin-details-btn') ||
                activeEl.classList.contains('moonfin-details-close') ||
                activeEl.tagName === 'BODY'
            );
            
            const isInMediabar = activeEl && activeEl.closest('.moonfin-mediabar');
            
            if (isInMediabar) {
                if (this.matchKey(key, this.KEYS.LEFT)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof MediaBar !== 'undefined' && MediaBar.prevSlide) {
                        MediaBar.prevSlide();
                    }
                    return;
                } else if (this.matchKey(key, this.KEYS.RIGHT)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof MediaBar !== 'undefined' && MediaBar.nextSlide) {
                        MediaBar.nextSlide();
                    }
                    return;
                } else if (this.matchKey(key, this.KEYS.DOWN)) {
                    // From mediabar, go to Jellyfin content
                    e.preventDefault();
                    e.stopPropagation();
                    this.focusJellyfinContent();
                    return;
                } else if (this.matchKey(key, this.KEYS.UP)) {
                    // From mediabar, go to navbar
                    e.preventDefault();
                    e.stopPropagation();
                    const homeBtn = document.querySelector('.moonfin-navbar .moonfin-nav-home');
                    if (homeBtn) {
                        this.focusElement(homeBtn);
                    }
                    return;
                } else if (this.matchKey(key, this.KEYS.ENTER)) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (typeof MediaBar !== 'undefined' && MediaBar.items && MediaBar.items[MediaBar.currentIndex]) {
                        const item = MediaBar.items[MediaBar.currentIndex];
                        if (typeof Details !== 'undefined') {
                            Details.showDetails(item.Id, item.Type);
                        } else {
                            API.navigateToItem(item.Id);
                        }
                    }
                    return;
                }
            }
            
            if (!isMoonfinElement) return;
            
            if (this.matchKey(key, this.KEYS.LEFT)) {
                e.preventDefault();
                e.stopPropagation();
                this.navigate('left');
            } else if (this.matchKey(key, this.KEYS.RIGHT)) {
                e.preventDefault();
                e.stopPropagation();
                this.navigate('right');
            } else if (this.matchKey(key, this.KEYS.UP)) {
                e.preventDefault();
                e.stopPropagation();
                this.navigate('up');
            } else if (this.matchKey(key, this.KEYS.DOWN)) {
                e.preventDefault();
                e.stopPropagation();
                this.navigate('down');
            } else if (this.matchKey(key, this.KEYS.ENTER)) {
                e.preventDefault();
                e.stopPropagation();
                this.activateFocused();
            } else if (this.matchKey(key, this.KEYS.BACK)) {
                this.handleBack(e);
            }
        }, true); // <-- capture phase
    },

    matchKey(key, keyArray) {
        return keyArray.includes(key) || keyArray.includes(parseInt(key));
    },

    setupMutationObserver() {
        var self = this;
        var debounceTimer = null;
        const observer = new MutationObserver(() => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                self.updateFocusableElements();
            }, 150);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    updateFocusableElements() {
        this.focusableElements = Array.from(
            document.querySelectorAll(this.focusableSelector)
        ).filter(el => {

            const style = window.getComputedStyle(el);
            return style.display !== 'none' && 
                   style.visibility !== 'hidden' &&
                   !el.disabled &&
                   !el.classList.contains('hidden');
        });
    },

    navigate(direction) {
        this.updateFocusableElements();
        
        const currentFocused = document.activeElement;
        const currentIndex = this.focusableElements.indexOf(currentFocused);
        
        if (direction === 'down' && this.isInNavbar(currentFocused)) {
            if (this.focusMediabar()) {
                return;
            }
            // Otherwise hand off focus to Jellyfin content below
            if (this.focusJellyfinContent()) {
                return;
            }
        }
        
        if (direction === 'up' && !this.isInNavbar(currentFocused) && !this.isInMediabar(currentFocused)) {
            if (this.focusMediabar()) {
                return;
            }
            const navbar = document.querySelector('.moonfin-navbar');
            if (navbar) {
                const navbarRect = navbar.getBoundingClientRect();
                const currentRect = currentFocused.getBoundingClientRect();
                
                // If we're near the top, try to focus navbar
                if (currentRect.top < navbarRect.bottom + 200) {
                    const homeBtn = navbar.querySelector('.moonfin-nav-home');
                    if (homeBtn) {
                        this.focusElement(homeBtn);
                        return;
                    }
                }
            }
        }
        
        if (this.focusableElements.length === 0) return;
        
        let nextElement = null;
        
        if (currentIndex === -1) {
            nextElement = this.focusableElements[0];
        } else {
            nextElement = this.findNextElement(currentFocused, direction);
        }
        
        if (nextElement) {
            this.focusElement(nextElement);
        } else if (direction === 'down') {
            // No moonfin element found below, try Jellyfin content
            this.focusJellyfinContent();
        }
    },
    
    isInNavbar(element) {
        return element && element.closest('.moonfin-navbar') !== null;
    },
    
    isInMediabar(element) {
        return element && element.closest('.moonfin-mediabar') !== null;
    },
    
    focusMediabar() {
        const mediabar = document.querySelector('.moonfin-mediabar');
        if (!mediabar) return false;
        
        const style = window.getComputedStyle(mediabar);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return false;
        }
        
        if (typeof MediaBar === 'undefined' || !MediaBar.items || MediaBar.items.length === 0) {
            return false;
        }
        
        // Focus the mediabar content area (make it focusable)
        const content = mediabar.querySelector('.moonfin-mediabar-content');
        if (content) {
            content.setAttribute('tabindex', '0');
            content.focus();
            content.classList.add('moonfin-focused');
            console.log('[Moonfin TV] Focused mediabar');
            return true;
        }
        
        return false;
    },
    
    focusJellyfinContent() {
        // Jellyfin uses these selectors for focusable content
        const jellyfinSelectors = [
            '.card',
            '.listItem',
            '.emby-button',
            '.emby-tab-button',
            '.itemsContainer button',
            '.section0 .card',
            '.homeSection .card',
            '[data-action]',
            '.button-flat',
            '.raised'
        ];
        
        const navbar = document.querySelector('.moonfin-navbar');
        const mediabar = document.querySelector('.moonfin-mediabar');
        
        let topOffset = 0;
        if (navbar) {
            topOffset = Math.max(topOffset, navbar.getBoundingClientRect().bottom);
        }
        if (mediabar && window.getComputedStyle(mediabar).display !== 'none') {
            topOffset = Math.max(topOffset, mediabar.getBoundingClientRect().bottom);
        }
        
        for (const selector of jellyfinSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const el of elements) {
                const rect = el.getBoundingClientRect();
                // Find first element below our UI that's visible
                if (rect.top > topOffset && rect.width > 0 && rect.height > 0) {
                    el.focus();
                    el.classList.add('moonfin-jf-focused');
                    console.log('[Moonfin TV] Focused Jellyfin element:', el);
                    return true;
                }
            }
        }
        
        return false;
    },

    findNextElement(currentElement, direction) {
        const currentRect = currentElement.getBoundingClientRect();
        const currentCenter = {
            x: currentRect.left + currentRect.width / 2,
            y: currentRect.top + currentRect.height / 2
        };
        
        let candidates = [];
        
        for (const el of this.focusableElements) {
            if (el === currentElement) continue;
            
            const rect = el.getBoundingClientRect();
            const center = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
            
            let isValid = false;
            let distance = Infinity;
            
            switch (direction) {
                case 'left':
                    isValid = center.x < currentCenter.x;
                    distance = this.calculateDistance(currentCenter, center, 'horizontal');
                    break;
                case 'right':
                    isValid = center.x > currentCenter.x;
                    distance = this.calculateDistance(currentCenter, center, 'horizontal');
                    break;
                case 'up':
                    isValid = center.y < currentCenter.y;
                    distance = this.calculateDistance(currentCenter, center, 'vertical');
                    break;
                case 'down':
                    isValid = center.y > currentCenter.y;
                    distance = this.calculateDistance(currentCenter, center, 'vertical');
                    break;
            }
            
            if (isValid) {
                candidates.push({ element: el, distance });
            }
        }
        
        candidates.sort((a, b) => a.distance - b.distance);
        return candidates[0]?.element || null;
    },

    calculateDistance(from, to, axis) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        
        // Weight the perpendicular axis more heavily to prefer elements in a line
        if (axis === 'horizontal') {
            return Math.abs(dx) + Math.abs(dy) * 2;
        } else {
            return Math.abs(dy) + Math.abs(dx) * 2;
        }
    },

    focusElement(element) {
        this.focusableElements.forEach(el => {
            el.classList.remove('moonfin-focused');
        });
        
        element.classList.add('moonfin-focused');
        element.focus();
        
        element.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'nearest'
        });
    },

    activateFocused() {
        const focused = document.activeElement;
        if (focused && this.focusableElements.includes(focused)) {
            focused.click();
        }
    },

    handleBack(e) {
        const settingsPanel = document.querySelector('.moonfin-settings-panel');
        const jellyseerrModal = document.querySelector('.moonfin-jellyseerr-modal');
        
        if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
            e.preventDefault();
            settingsPanel.classList.add('hidden');
            return;
        }
        
        if (jellyseerrModal) {
            e.preventDefault();
            jellyseerrModal.remove();
            return;
        }
        
        // Otherwise, let jellyfin-web handle the back navigation
        // or call NativeShell if available
        if (window.NativeShell?.AppHost?.exit) {
            // Don't prevent default - let the app handle it
        }
    },

    setFocus(selector) {
        this.updateFocusableElements();
        const element = document.querySelector(selector);
        if (element && this.focusableElements.includes(element)) {
            this.focusElement(element);
        }
    },

    focusFirst() {
        this.updateFocusableElements();
        if (this.focusableElements.length > 0) {
            this.focusElement(this.focusableElements[0]);
        }
    },

    addFocusableSelector(selector) {
        this.focusableSelector += `, ${selector}`;
        this.updateFocusableElements();
    },

    disable() {
        this.enabled = false;
    },

    enable() {
        if (this.isTV()) {
            this.enabled = true;
        }
    }
};


// === components/navbar.js ===
const Navbar = {
    container: null,
    clockInterval: null,
    initialized: false,
    libraries: [],
    currentUser: null,
    librariesExpanded: false,
    librariesTimeout: null,

    getFallbackUserIconSvg: function() {
        return '<svg class="moonfin-user-fallback-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="#FFFFFF"><path d="M372-523q-42-42-42-108t42-108q42-42 108-42t108 42q42 42 42 108t-42 108q-42 42-108 42t-108-42ZM160-160v-94q0-38 19-65t49-41q67-30 128.5-45T480-420q62 0 123 15.5T731-360q31 14 50 41t19 65v94H160Zm60-60h520v-34q0-16-9.5-30.5T707-306q-64-31-117-42.5T480-360q-57 0-111 11.5T252-306q-14 7-23 21.5t-9 30.5v34Zm324.5-346.5Q570-592 570-631t-25.5-64.5Q519-721 480-721t-64.5 25.5Q390-670 390-631t25.5 64.5Q441-541 480-541t64.5-25.5ZM480-631Zm0 411Z"/></svg>';
    },

    isMobile: function() {
        return window.innerWidth <= 768;
    },

    async init() {
        if (this.initialized) return;

        console.log('[Moonfin] Initializing navbar...');

        try {
            await this.waitForApi();
        } catch (e) {
            console.error('[Moonfin] Navbar: Failed to initialize -', e.message);
            return;
        }

        this.createNavbar();

        await this.loadUserData();

        this.setupEventListeners();

        this.startClock();

        this.initialized = true;

        if (Jellyseerr.config) {
            this.updateJellyseerrButton(Jellyseerr.config);
        }

        console.log('[Moonfin] Navbar initialized');
    },

    waitForApi() {
        return new Promise(function(resolve, reject) {
            var attempts = 0;
            var maxAttempts = 100;
            
            var check = function() {
                var api = API.getApiClient();
                if (api && api._currentUser && api._currentUser.Id) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('API timeout'));
                } else {
                    attempts++;
                    setTimeout(check, 100);
                }
            };
            check();
        });
    },

    createNavbar() {
        var existing = document.querySelector('.moonfin-navbar');
        if (existing) {
            existing.remove();
        }

        var settings = Storage.getAll();
        var overlayColor = Storage.getColorRgba(settings.mediaBarOverlayColor, settings.mediaBarOpacity);

        this.container = document.createElement('nav');
        this.container.className = 'moonfin-navbar';
        this.container.innerHTML = [
            '<div class="moonfin-navbar-left">',
            '    <button class="moonfin-user-btn" title="User Menu">',
            '        <div class="moonfin-user-avatar">',
            '            ' + this.getFallbackUserIconSvg(),
            '        </div>',
            '    </button>',
            '    <button class="moonfin-details-nav-back" title="Back" style="display:none">',
            '        <svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>',
            '    </button>',
            '</div>',
            '',
            '<div class="moonfin-navbar-center">',
            '    <div class="moonfin-nav-pill" style="background: ' + overlayColor + '">',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-home" data-action="home" title="Home">',
            '            <svg class="moonfin-nav-icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
            '            <span class="moonfin-expand-label">Home</span>',
            '        </button>',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-search" data-action="search" title="Search">',
            '            <svg class="moonfin-nav-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
            '            <span class="moonfin-expand-label">Search</span>',
            '        </button>',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-shuffle' + (!settings.showShuffleButton ? ' hidden' : '') + '" data-action="shuffle" title="Shuffle">',
            '            <svg class="moonfin-nav-icon" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
            '            <span class="moonfin-expand-label">Shuffle</span>',
            '        </button>',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-genres' + (!settings.showGenresButton ? ' hidden' : '') + '" data-action="genres" title="Genres">',
            '<svg class="moonfin-nav-icon" viewBox="0 0 24 24"><path d="M8.11,19.45C5.94,18.65 4.22,16.78 3.71,14.35L2.05,6.54C1.81,5.46 2.5,4.4 3.58,4.17L13.35,2.1L13.38,2.09C14.45,1.88 15.5,2.57 15.72,3.63L16.07,5.3L20.42,6.23H20.45C21.5,6.47 22.18,7.53 21.96,8.59L20.3,16.41C19.5,20.18 15.78,22.6 12,21.79C10.42,21.46 9.08,20.61 8.11,19.45V19.45M20,8.18L10.23,6.1L8.57,13.92V13.95C8,16.63 9.73,19.27 12.42,19.84C15.11,20.41 17.77,18.69 18.34,16L20,8.18M16,16.5C15.37,17.57 14.11,18.16 12.83,17.89C11.56,17.62 10.65,16.57 10.5,15.34L16,16.5M8.47,5.17L4,6.13L5.66,13.94L5.67,13.97C5.82,14.68 6.12,15.32 6.53,15.87C6.43,15.1 6.45,14.3 6.62,13.5L7.05,11.5C6.6,11.42 6.21,11.17 6,10.81C6.06,10.2 6.56,9.66 7.25,9.5C7.33,9.5 7.4,9.5 7.5,9.5L8.28,5.69C8.32,5.5 8.38,5.33 8.47,5.17M15.03,12.23C15.35,11.7 16.03,11.42 16.72,11.57C17.41,11.71 17.91,12.24 18,12.86C17.67,13.38 17,13.66 16.3,13.5C15.61,13.37 15.11,12.84 15.03,12.23M10.15,11.19C10.47,10.66 11.14,10.38 11.83,10.53C12.5,10.67 13.03,11.21 13.11,11.82C12.78,12.34 12.11,12.63 11.42,12.5C10.73,12.33 10.23,11.8 10.15,11.19M11.97,4.43L13.93,4.85L13.77,4.05L11.97,4.43Z"/></svg>',
            '            <span class="moonfin-expand-label">Genres</span>',
            '        </button>',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-favorites' + (!settings.showFavoritesButton ? ' hidden' : '') + '" data-action="favorites" title="Favorites">',
            '            <svg class="moonfin-nav-icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
            '            <span class="moonfin-expand-label">Favorites</span>',
            '        </button>',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-jellyseerr hidden" data-action="jellyseerr" title="Seerr">',
            '<svg class="moonfin-nav-icon" viewBox="0 0 96 96" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-opacity="0.13" d="M96.1,48c0,26.31 -21.18,47.71 -47.48,48C22.31,96.28 0.68,75.33 0.11,49.03C-0.45,22.73 20.26,0.87 46.56,0.03c26.3,-0.85 48.37,19.63 49.5,45.92"/><path fill-opacity="0.4" d="M42.87,45.59h-2.49c-3.33,12.42 -4.89,30.36 -4.17,43.88c0.79,14.88 4.85,29.2 6.2,29.2s-0.71,-9.11 0.21,-29.17c0.62,-13.38 4.41,-25.95 4.7,-43.91h-4.46z"/><path fill-opacity="0.4" d="M64.09,45.86h2.49c3.33,12.42 4.89,30.36 4.17,43.88c-0.79,14.88 -4.85,29.2 -6.2,29.2s0.71,-9.11 -0.21,-29.17c-0.62,-13.38 -4.41,-25.95 -4.7,-43.91h4.46z"/><path fill-opacity="0.53" d="M38.05,70.69l-5.06,-1.13s-1.17,7.43 -1.61,11.15c-0.71,6.02 -1.57,14.34 -1.23,20.71c0.37,7.01 2.29,13.76 2.92,13.76s-0.34,-4.29 0.1,-13.75c0.29,-6.3 1.33,-13.87 2.58,-20.72c0.62,-3.38 2.42,-10.02 2.42,-10.02z"/><path fill-opacity="0.53" d="M59.41,70.16h1.55c2.08,7.76 2.47,18.96 2.02,27.4c-0.49,9.29 -3.03,18.23 -3.87,18.23s0.45,-5.69 -0.13,-18.21c-0.39,-8.35 -2.16,-16.2 -2.35,-27.41h2.78z"/><path fill-opacity="0.67" d="M35.18,39.95l-5.67,-2.02s-2.08,13.26 -2.87,19.92c-1.26,10.75 -3.75,25.61 -3.14,36.99c0.67,12.53 4.09,24.58 5.22,24.58s-0.6,-7.67 0.18,-24.56c0.52,-11.26 3.97,-21.94 5.14,-37.01c0.47,-5.99 1.37,-17.9 1.37,-17.9z"/><path fill-opacity="0.67" d="M53.91,45.86l-5.11,0.87s0.68,9.93 0.68,15.58c0,9.16 0.36,18.42 0.33,28.03c-0.03,11.05 1.81,29.55 2.77,29.55s4.06,-23.82 4.72,-38.06c0.44,-9.5 -0.97,-17.84 -1.22,-23.52c-0.22,-5.06 -0.93,-11.88 -0.93,-11.88z"/><path d="M82.09,48.88c0,12.9 -2.19,13.68 -5.78,19.15c-2.58,3.92 2.64,6.96 0.55,8.04c-2.5,1.29 -1.71,-1.05 -6.67,-2.38c-2.15,-0.57 -6.84,0.06 -8.74,0.43c-1.88,0.36 -7.61,-2.83 -9.14,-3.24c-2.27,-0.61 -7.84,2.35 -11.23,2.35s-6.94,-2.96 -11.46,-1.75c-5.36,1.44 -11.83,4.94 -12.81,3.79c-1.88,-2.19 4.1,-3.86 1.88,-7.76c-1.4,-2.47 -6.27,-8.98 -6.41,-15.56c-0.45,-21.16 17.07,-39.03 35.84,-39.03s33.95,16.28 33.95,34.49"/><path fill-rule="evenodd" d="M46.95,19.63c-10.25,0 -24.58,10.61 -24.58,20.86c0,1.14 -0.92,2.06 -2.06,2.06s-2.06,-0.92 -2.06,-2.06c0,-12.52 16.17,-24.98 28.7,-24.98c1.14,0 2.06,0.92 2.06,2.06s-0.92,2.06 -2.06,2.06z"/><path fill-opacity="0.87" d="M62.12,58.41c-1.09,1.78 -2.57,3.21 -4.32,4.19c-0.75,0.41 -1.54,0.74 -2.36,0.98c-2.45,1.1 -5.2,1.69 -7.99,1.75c-9.53,0.17 -17.44,-5.92 -17.75,-13.65c-0.15,-3.79 2.11,-7.72 3.86,-10.75c1.48,-2.56 4.03,-6.97 7.39,-8.73c6.85,-3.6 16.08,0.21 20.7,8.55c1.34,2.42 2.19,5.07 2.48,7.71c0.21,0.86 0.33,1.74 0.34,2.62c0.03,2.29 -0.63,4.55 -1.91,6.58c-0.13,0.26 -0.27,0.51 -0.42,0.75z"/><path d="M47.07,39.46c5.94,0 10.75,4.81 10.75,10.75s-4.81,10.75 -10.75,10.75s-10.75,-4.81 -10.75,-10.75c0,-1.1 0.16,-2.16 0.47,-3.17c0.84,1.87 2.72,3.17 4.9,3.17c2.97,0 5.37,-2.41 5.37,-5.37c0,-2.18 -1.3,-4.06 -3.17,-4.9c1,-0.31 2.06,-0.47 3.17,-0.47z"/></svg>',
            '            <span class="moonfin-expand-label">Seerr</span>',
            '        </button>',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-cast' + (!settings.showCastButton ? ' hidden' : '') + '" data-action="cast" title="Cast">',
            '            <svg class="moonfin-nav-icon" viewBox="0 0 24 24"><path d="M1 18v3h3c0-1.66-1.34-3-3-3m0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7m0-4v2a9 9 0 0 1 9 9h2c0-6.08-4.93-11-11-11m20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2"/></svg>',
            '            <span class="moonfin-expand-label">Cast</span>',
            '        </button>',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-syncplay' + (!settings.showSyncPlayButton ? ' hidden' : '') + '" data-action="syncplay" title="SyncPlay">',
            '<svg class="moonfin-nav-icon" viewBox="0 -960 960 960"><path d="M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z"/></svg>',
            '            <span class="moonfin-expand-label">SyncPlay</span>',
            '        </button>',
            '',
            '        <div class="moonfin-libraries-group' + (!settings.showLibrariesInToolbar ? ' hidden' : '') + '">',
            '            <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-libraries-btn" data-action="libraries-toggle" title="Libraries">',
            '                <svg class="moonfin-nav-icon" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>',
            '                <span class="moonfin-expand-label">Libraries</span>',
            '            </button>',
            '            <div class="moonfin-libraries-list">',
            '            </div>',
            '        </div>',
            '',
            '        <button class="moonfin-nav-btn moonfin-expandable-btn moonfin-nav-settings" data-action="settings" title="Settings">',
            '            <svg class="moonfin-nav-icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
            '            <span class="moonfin-expand-label">Settings</span>',
            '        </button>',
            '',
            '    </div>',
            '</div>',
            '',
            '<div class="moonfin-navbar-right">',
            '    <div class="moonfin-clock' + (!settings.showClock ? ' hidden' : '') + '">',
            '        <span class="moonfin-clock-time">--:--</span>',
            '    </div>',
            '</div>'
        ].join('\n');

        document.body.insertBefore(this.container, document.body.firstChild);

        document.body.classList.add('moonfin-navbar-active');
    },

    async loadUserData() {
        this.currentUser = await API.getCurrentUser();
        if (this.currentUser) {
            this.updateUserAvatar();
        }

        this.libraries = await API.getUserViews();
        this.updateLibraries();
    },

    updateUserAvatar() {
        var avatarContainer = this.container.querySelector('.moonfin-user-avatar');
        if (!avatarContainer || !this.currentUser) return;

        var avatarUrl = API.getUserAvatarUrl(this.currentUser);
        if (avatarUrl) {
            avatarContainer.innerHTML = '<img src="' + avatarUrl + '" alt="' + (this.currentUser.Name || '') + '" class="moonfin-user-img">';
        } else {
            avatarContainer.innerHTML = this.getFallbackUserIconSvg();
        }
    },

    updateLibraries() {
        var librariesList = this.container.querySelector('.moonfin-libraries-list');
        if (!librariesList) return;

        librariesList.innerHTML = this.libraries.map(function(lib) {
            var collectionType = lib.CollectionType || '';
            return '<button class="moonfin-nav-btn moonfin-library-btn" data-action="library" data-library-id="' + lib.Id + '" data-collection-type="' + collectionType + '" title="' + lib.Name + '">' +
                '<span class="moonfin-library-name">' + lib.Name + '</span>' +
            '</button>';
        }).join('');
    },

    getLibraryUrl: function(libraryId, collectionType) {
        var type = (collectionType || '').toLowerCase();
        switch (type) {
            case 'movies':
                return '/movies?topParentId=' + libraryId + '&collectionType=' + collectionType;
            case 'tvshows':
                return '/tv?topParentId=' + libraryId + '&collectionType=' + collectionType;
            case 'music':
                return '/music?topParentId=' + libraryId + '&collectionType=' + collectionType;
            case 'livetv':
                return '/livetv?collectionType=' + collectionType;
            case 'homevideos':
                return '/homevideos?topParentId=' + libraryId;
            case 'books':
                return '/list?parentId=' + libraryId;
            default:
                return '/list?parentId=' + libraryId;
        }
    },

    positionLibrariesDropdown() {
        if (this.isMobile()) return;
        var btn = this.container.querySelector('.moonfin-libraries-btn');
        var list = this.container.querySelector('.moonfin-libraries-list');
        if (!btn || !list) return;

        var rect = btn.getBoundingClientRect();
        list.style.top = (rect.bottom + 8) + 'px';
        list.style.left = rect.left + 'px';

        var pill = this.container.querySelector('.moonfin-nav-pill');
        if (pill) {
            list.style.background = pill.style.background;
        }
    },

    toggleLibraries() {
        var group = this.container.querySelector('.moonfin-libraries-group');
        if (!group) return;

        this.librariesExpanded = !this.librariesExpanded;
        group.classList.toggle('expanded', this.librariesExpanded);

        if (this.librariesExpanded) {
            this.positionLibrariesDropdown();
        }

        if (this.isMobile() && this.librariesExpanded) {
            var pill = this.container.querySelector('.moonfin-nav-pill');
            if (pill) {
                setTimeout(function() {
                    group.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
                }, 50);
            }
        }
    },

    collapseLibraries() {
        if (this.isMobile()) return;

        var self = this;
        if (this.librariesTimeout) {
            clearTimeout(this.librariesTimeout);
        }
        this.librariesTimeout = setTimeout(function() {
            self.librariesExpanded = false;
            var group = self.container ? self.container.querySelector('.moonfin-libraries-group') : null;
            if (group) {
                group.classList.remove('expanded');
            }
        }, 150);
    },

    cancelCollapseLibraries() {
        if (this.librariesTimeout) {
            clearTimeout(this.librariesTimeout);
            this.librariesTimeout = null;
        }
    },

    setupEventListeners() {
        var self = this;

        this.container.addEventListener('click', function(e) {
            var btn = e.target.closest('.moonfin-nav-btn');
            if (!btn) return;

            var action = btn.dataset.action;
            if (action === 'libraries-toggle') {
                self.toggleLibraries();
                return;
            }
            self.handleNavigation(action, btn);
        });

        var userBtn = this.container.querySelector('.moonfin-user-btn');
        if (userBtn) {
            userBtn.addEventListener('click', function() {
                if (Genres.isVisible) Genres.close();
                if (Details.isVisible) Details.hide(true);
                API.navigateTo('/mypreferencesmenu');
            });
        }

        var navBack = this.container.querySelector('.moonfin-details-nav-back');
        if (navBack) {
            navBack.addEventListener('click', function() {
                if (typeof Details !== 'undefined' && Details.isVisible) Details.goBack();
            });
        }

        var librariesGroup = this.container.querySelector('.moonfin-libraries-group');
        if (librariesGroup) {
            librariesGroup.addEventListener('mouseenter', function() {
                if (!self.isMobile()) {
                    self.cancelCollapseLibraries();
                    self.librariesExpanded = true;
                    librariesGroup.classList.add('expanded');
                    self.positionLibrariesDropdown();
                }
            });
            librariesGroup.addEventListener('mouseleave', function() {
                if (!self.isMobile()) {
                    self.collapseLibraries();
                }
            });
            librariesGroup.addEventListener('focusin', function() {
                if (!self.isMobile()) {
                    self.cancelCollapseLibraries();
                    self.librariesExpanded = true;
                    librariesGroup.classList.add('expanded');
                    self.positionLibrariesDropdown();
                }
            });
            librariesGroup.addEventListener('focusout', function(e) {
                if (self.isMobile()) return;
                if (e.relatedTarget && librariesGroup.contains(e.relatedTarget)) {
                    return;
                }
                self.collapseLibraries();
            });

            var librariesList = librariesGroup.querySelector('.moonfin-libraries-list');
            if (librariesList) {
                librariesList.addEventListener('mouseenter', function() {
                    if (!self.isMobile()) {
                        self.cancelCollapseLibraries();
                    }
                });
                librariesList.addEventListener('mouseleave', function() {
                    if (!self.isMobile()) {
                        self.collapseLibraries();
                    }
                });
            }
        }

        this._onSettingsChanged = function(e) {
            self.applySettings(e.detail);
        };
        this._onViewShow = function() {
            self.updateActiveState();
        };
        this._onJellyseerrConfig = function(e) {
            self.updateJellyseerrButton(e.detail);
        };

        window.addEventListener('moonfin-settings-changed', this._onSettingsChanged);
        window.addEventListener('viewshow', this._onViewShow);
        window.addEventListener('moonfin-jellyseerr-config', this._onJellyseerrConfig);
    },

    updateJellyseerrButton(config) {
        var btn = this.container ? this.container.querySelector('.moonfin-nav-jellyseerr') : null;
        if (!btn) return;

        if (config && config.enabled && config.url) {
            btn.classList.remove('hidden');
            var label = btn.querySelector('.moonfin-expand-label');
            if (label) {
                label.textContent = config.displayName || 'Seerr';
            }
            btn.title = config.displayName || 'Seerr';
            
            // Swap icon based on variant
            var iconEl = btn.querySelector('.moonfin-nav-icon');
            if (iconEl && Jellyseerr.icons) {
                var variant = config.variant || 'seerr';
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = Jellyseerr.getIcon(variant);
                var newIcon = tempDiv.querySelector('svg');
                if (newIcon) {
                    newIcon.classList.add('moonfin-nav-icon');
                    newIcon.classList.remove('moonfin-jellyseerr-icon');
                    iconEl.replaceWith(newIcon);
                }
            }
        } else {
            btn.classList.add('hidden');
        }
    },

    async handleNavigation(action, btn) {
        if (action !== 'settings' && Details.isVisible) {
            Details.hide(true);
        }

        if (action !== 'jellyseerr' && action !== 'settings' && Jellyseerr.isOpen) {
            Jellyseerr.close();
            this.updateJellyseerrButtonState();
        }

        if (action !== 'genres' && action !== 'settings' && Genres.isVisible) {
            Genres.close();
        }

        if (action !== 'library' && action !== 'settings' && Library.isVisible) {
            Library.close();
        }

        switch (action) {
            case 'home':
                API.navigateTo('/home');
                break;
            case 'search':
                API.navigateTo('/search');
                break;
            case 'shuffle':
                await this.handleShuffle();
                break;
            case 'genres':
                if (Genres.isVisible) {
                    Genres.close();
                } else {
                    Genres.show();
                }
                break;
            case 'favorites':
                API.navigateTo('/home?tab=1');
                break;
            case 'settings':
                Settings.show();
                break;
            case 'cast':
                this.showCastMenu(btn);
                break;
            case 'syncplay':
                this.showSyncPlayMenu(btn);
                break;
            case 'jellyseerr':
                Jellyseerr.toggle();
                this.updateJellyseerrButtonState();
                break;
            case 'library':
                var libraryId = btn.dataset.libraryId;
                var collectionType = btn.dataset.collectionType;
                var libraryName = btn.getAttribute('title');
                if (libraryId) {
                    var type = (collectionType || '').toLowerCase();
                    if (type !== 'livetv') {
                        Library.show(libraryId, libraryName, collectionType);
                    } else {
                        API.navigateTo(this.getLibraryUrl(libraryId, collectionType));
                    }
                }
                break;
        }
    },

    updateJellyseerrButtonState() {
        var btn = this.container ? this.container.querySelector('.moonfin-nav-jellyseerr') : null;
        if (btn) {
            btn.classList.toggle('active', Jellyseerr.isOpen);
        }
    },

    showCastMenu() {
        var nativeCastBtn = document.querySelector('.headerCastButton, .castButton');
        if (nativeCastBtn) {
            nativeCastBtn.click();
        }
    },

    showSyncPlayMenu() {
        if (Device.isTV()) return;
        if (typeof SyncPlay !== 'undefined') {
            SyncPlay.toggle();
        } else {
            var nativeSyncBtn = document.querySelector('.headerSyncButton, .syncButton');
            if (nativeSyncBtn) {
                nativeSyncBtn.click();
            }
        }
    },

    async handleShuffle() {
        var settings = Storage.getAll();
        var items = await API.getRandomItems({
            contentType: settings.shuffleContentType,
            limit: 1
        });

        if (items.length > 0) {
            var item = items[0];
            if (typeof Details !== 'undefined' && Storage.get('detailsPageEnabled')) {
                Details.showDetails(item.Id, item.Type);
            } else {
                API.navigateToItem(item.Id);
            }
        }
    },

    updateActiveState() {
        if (!this.container) return;

        var path = window.location.pathname + window.location.search;
        
        this.container.querySelectorAll('.moonfin-nav-btn').forEach(function(btn) {
            btn.classList.remove('active');
        });

        if (path.indexOf('/home') !== -1) {
            var homeBtn = this.container.querySelector('.moonfin-nav-home');
            if (homeBtn) homeBtn.classList.add('active');
        } else if (path.indexOf('/search') !== -1) {
            var searchBtn = this.container.querySelector('.moonfin-nav-search');
            if (searchBtn) searchBtn.classList.add('active');
        }

        var urlParams = new URLSearchParams(window.location.search);
        var parentId = urlParams.get('parentId');
        if (parentId) {
            var libraryBtn = this.container.querySelector('[data-library-id="' + parentId + '"]');
            if (libraryBtn) {
                libraryBtn.classList.add('active');
            }
        }
    },

    startClock() {
        var self = this;
        var updateClock = function() {
            var clockElement = self.container ? self.container.querySelector('.moonfin-clock-time') : null;
            if (!clockElement) return;

            var now = new Date();
            var settings = Storage.getAll();
            
            var hours = now.getHours();
            var minutes = now.getMinutes();
            var suffix = '';

            if (!settings.use24HourClock) {
                suffix = hours >= 12 ? ' PM' : ' AM';
                hours = hours % 12 || 12;
            }

            clockElement.textContent = hours + ':' + minutes.toString().padStart(2, '0') + suffix;
        };

        updateClock();
        this.clockInterval = setInterval(updateClock, 1000);
    },

    applySettings(settings) {
        if (!this.container) return;

        var overlayColor = Storage.getColorRgba(settings.mediaBarOverlayColor, settings.mediaBarOpacity);
        
        var pill = this.container.querySelector('.moonfin-nav-pill');
        if (pill) {
            pill.style.background = overlayColor;
        }

        var shuffleBtn = this.container.querySelector('.moonfin-nav-shuffle');
        if (shuffleBtn) shuffleBtn.classList.toggle('hidden', !settings.showShuffleButton);

        var genresBtn = this.container.querySelector('.moonfin-nav-genres');
        if (genresBtn) genresBtn.classList.toggle('hidden', !settings.showGenresButton);

        var favoritesBtn = this.container.querySelector('.moonfin-nav-favorites');
        if (favoritesBtn) favoritesBtn.classList.toggle('hidden', !settings.showFavoritesButton);

        var librariesGroup = this.container.querySelector('.moonfin-libraries-group');
        if (librariesGroup) librariesGroup.classList.toggle('hidden', !settings.showLibrariesInToolbar);

        var clock = this.container.querySelector('.moonfin-clock');
        if (clock) clock.classList.toggle('hidden', !settings.showClock);
    },

    destroy() {
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
            this.clockInterval = null;
        }
        if (this.librariesTimeout) {
            clearTimeout(this.librariesTimeout);
            this.librariesTimeout = null;
        }
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        if (this._onSettingsChanged) {
            window.removeEventListener('moonfin-settings-changed', this._onSettingsChanged);
            this._onSettingsChanged = null;
        }
        if (this._onViewShow) {
            window.removeEventListener('viewshow', this._onViewShow);
            this._onViewShow = null;
        }
        if (this._onJellyseerrConfig) {
            window.removeEventListener('moonfin-jellyseerr-config', this._onJellyseerrConfig);
            this._onJellyseerrConfig = null;
        }
        document.body.classList.remove('moonfin-navbar-active');
        this.librariesExpanded = false;
        this.initialized = false;
    }
};


// === components/sidebar.js ===
const Sidebar = {
    container: null,
    overlay: null,
    mobileTrigger: null,
    clockInterval: null,
    initialized: false,
    libraries: [],
    currentUser: null,
    librariesExpanded: false,

    isMobile: function() {
        return window.innerWidth <= 768;
    },

    async init() {
        if (this.initialized) return;

        console.log('[Moonfin] Initializing sidebar...');

        try {
            await this.waitForApi();
        } catch (e) {
            console.error('[Moonfin] Sidebar: Failed to initialize -', e.message);
            return;
        }

        this.createSidebar();

        await this.loadUserData();

        this.setupEventListeners();

        this.startClock();

        this.initialized = true;

        if (Jellyseerr.config) {
            this.updateJellyseerrButton(Jellyseerr.config);
        }

        console.log('[Moonfin] Sidebar initialized');
    },

    waitForApi() {
        return new Promise(function(resolve, reject) {
            var attempts = 0;
            var maxAttempts = 100;

            var check = function() {
                var api = API.getApiClient();
                if (api && api._currentUser && api._currentUser.Id) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('API timeout'));
                } else {
                    attempts++;
                    setTimeout(check, 100);
                }
            };
            check();
        });
    },

    createSidebar() {
        var existing = document.querySelector('.moonfin-sidebar');
        if (existing) existing.remove();

        var existingOverlay = document.querySelector('.moonfin-sidebar-overlay');
        if (existingOverlay) existingOverlay.remove();

        var existingTrigger = document.querySelector('.moonfin-sidebar-mobile-trigger');
        if (existingTrigger) existingTrigger.remove();

        var existingDetailsBack = document.querySelector('.moonfin-details-sidebar-back');
        if (existingDetailsBack) existingDetailsBack.remove();

        var settings = Storage.getAll();

        this.container = document.createElement('nav');
        this.container.className = 'moonfin-sidebar';
        this.container.innerHTML = [
            '<div class="moonfin-sidebar-user">',
            '    <button class="moonfin-sidebar-user-btn" title="User Menu">',
            '        <div class="moonfin-sidebar-avatar">',
            '            <span class="moonfin-sidebar-initial">U</span>',
            '        </div>',
            '        <span class="moonfin-sidebar-username">User</span>',
            '    </button>',
            '</div>',
            '',
            '<div class="moonfin-sidebar-separator"></div>',
            '',
            '<div class="moonfin-sidebar-nav">',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-home" data-action="home" title="Home">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
            '        <span class="moonfin-sidebar-label">Home</span>',
            '    </button>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-search" data-action="search" title="Search">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>',
            '        <span class="moonfin-sidebar-label">Search</span>',
            '    </button>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-shuffle' + (!settings.showShuffleButton ? ' hidden' : '') + '" data-action="shuffle" title="Shuffle">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 24 24"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>',
            '        <span class="moonfin-sidebar-label">Shuffle</span>',
            '    </button>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-genres' + (!settings.showGenresButton ? ' hidden' : '') + '" data-action="genres" title="Genres">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 24 24"><path d="M8.11,19.45C5.94,18.65 4.22,16.78 3.71,14.35L2.05,6.54C1.81,5.46 2.5,4.4 3.58,4.17L13.35,2.1L13.38,2.09C14.45,1.88 15.5,2.57 15.72,3.63L16.07,5.3L20.42,6.23H20.45C21.5,6.47 22.18,7.53 21.96,8.59L20.3,16.41C19.5,20.18 15.78,22.6 12,21.79C10.42,21.46 9.08,20.61 8.11,19.45V19.45M20,8.18L10.23,6.1L8.57,13.92V13.95C8,16.63 9.73,19.27 12.42,19.84C15.11,20.41 17.77,18.69 18.34,16L20,8.18M16,16.5C15.37,17.57 14.11,18.16 12.83,17.89C11.56,17.62 10.65,16.57 10.5,15.34L16,16.5M8.47,5.17L4,6.13L5.66,13.94L5.67,13.97C5.82,14.68 6.12,15.32 6.53,15.87C6.43,15.1 6.45,14.3 6.62,13.5L7.05,11.5C6.6,11.42 6.21,11.17 6,10.81C6.06,10.2 6.56,9.66 7.25,9.5C7.33,9.5 7.4,9.5 7.5,9.5L8.28,5.69C8.32,5.5 8.38,5.33 8.47,5.17M15.03,12.23C15.35,11.7 16.03,11.42 16.72,11.57C17.41,11.71 17.91,12.24 18,12.86C17.67,13.38 17,13.66 16.3,13.5C15.61,13.37 15.11,12.84 15.03,12.23M10.15,11.19C10.47,10.66 11.14,10.38 11.83,10.53C12.5,10.67 13.03,11.21 13.11,11.82C12.78,12.34 12.11,12.63 11.42,12.5C10.73,12.33 10.23,11.8 10.15,11.19M11.97,4.43L13.93,4.85L13.77,4.05L11.97,4.43Z"/></svg>',
            '        <span class="moonfin-sidebar-label">Genres</span>',
            '    </button>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-favorites' + (!settings.showFavoritesButton ? ' hidden' : '') + '" data-action="favorites" title="Favorites">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
            '        <span class="moonfin-sidebar-label">Favorites</span>',
            '    </button>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-jellyseerr hidden" data-action="jellyseerr" title="Seerr">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 96 96" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-opacity="0.13" d="M96.1,48c0,26.31 -21.18,47.71 -47.48,48C22.31,96.28 0.68,75.33 0.11,49.03C-0.45,22.73 20.26,0.87 46.56,0.03c26.3,-0.85 48.37,19.63 49.5,45.92"/><path fill-opacity="0.4" d="M42.87,45.59h-2.49c-3.33,12.42 -4.89,30.36 -4.17,43.88c0.79,14.88 4.85,29.2 6.2,29.2s-0.71,-9.11 0.21,-29.17c0.62,-13.38 4.41,-25.95 4.7,-43.91h-4.46z"/><path fill-opacity="0.4" d="M64.09,45.86h2.49c3.33,12.42 4.89,30.36 4.17,43.88c-0.79,14.88 -4.85,29.2 -6.2,29.2s0.71,-9.11 -0.21,-29.17c-0.62,-13.38 -4.41,-25.95 -4.7,-43.91h4.46z"/><path fill-opacity="0.53" d="M38.05,70.69l-5.06,-1.13s-1.17,7.43 -1.61,11.15c-0.71,6.02 -1.57,14.34 -1.23,20.71c0.37,7.01 2.29,13.76 2.92,13.76s-0.34,-4.29 0.1,-13.75c0.29,-6.3 1.33,-13.87 2.58,-20.72c0.62,-3.38 2.42,-10.02 2.42,-10.02z"/><path fill-opacity="0.53" d="M59.41,70.16h1.55c2.08,7.76 2.47,18.96 2.02,27.4c-0.49,9.29 -3.03,18.23 -3.87,18.23s0.45,-5.69 -0.13,-18.21c-0.39,-8.35 -2.16,-16.2 -2.35,-27.41h2.78z"/><path fill-opacity="0.67" d="M35.18,39.95l-5.67,-2.02s-2.08,13.26 -2.87,19.92c-1.26,10.75 -3.75,25.61 -3.14,36.99c0.67,12.53 4.09,24.58 5.22,24.58s-0.6,-7.67 0.18,-24.56c0.52,-11.26 3.97,-21.94 5.14,-37.01c0.47,-5.99 1.37,-17.9 1.37,-17.9z"/><path fill-opacity="0.67" d="M53.91,45.86l-5.11,0.87s0.68,9.93 0.68,15.58c0,9.16 0.36,18.42 0.33,28.03c-0.03,11.05 1.81,29.55 2.77,29.55s4.06,-23.82 4.72,-38.06c0.44,-9.5 -0.97,-17.84 -1.22,-23.52c-0.22,-5.06 -0.93,-11.88 -0.93,-11.88z"/><path d="M82.09,48.88c0,12.9 -2.19,13.68 -5.78,19.15c-2.58,3.92 2.64,6.96 0.55,8.04c-2.5,1.29 -1.71,-1.05 -6.67,-2.38c-2.15,-0.57 -6.84,0.06 -8.74,0.43c-1.88,0.36 -7.61,-2.83 -9.14,-3.24c-2.27,-0.61 -7.84,2.35 -11.23,2.35s-6.94,-2.96 -11.46,-1.75c-5.36,1.44 -11.83,4.94 -12.81,3.79c-1.88,-2.19 4.1,-3.86 1.88,-7.76c-1.4,-2.47 -6.27,-8.98 -6.41,-15.56c-0.45,-21.16 17.07,-39.03 35.84,-39.03s33.95,16.28 33.95,34.49"/><path fill-rule="evenodd" d="M46.95,19.63c-10.25,0 -24.58,10.61 -24.58,20.86c0,1.14 -0.92,2.06 -2.06,2.06s-2.06,-0.92 -2.06,-2.06c0,-12.52 16.17,-24.98 28.7,-24.98c1.14,0 2.06,0.92 2.06,2.06s-0.92,2.06 -2.06,2.06z"/><path fill-opacity="0.87" d="M62.12,58.41c-1.09,1.78 -2.57,3.21 -4.32,4.19c-0.75,0.41 -1.54,0.74 -2.36,0.98c-2.45,1.1 -5.2,1.69 -7.99,1.75c-9.53,0.17 -17.44,-5.92 -17.75,-13.65c-0.15,-3.79 2.11,-7.72 3.86,-10.75c1.48,-2.56 4.03,-6.97 7.39,-8.73c6.85,-3.6 16.08,0.21 20.7,8.55c1.34,2.42 2.19,5.07 2.48,7.71c0.21,0.86 0.33,1.74 0.34,2.62c0.03,2.29 -0.63,4.55 -1.91,6.58c-0.13,0.26 -0.27,0.51 -0.42,0.75z"/><path d="M47.07,39.46c5.94,0 10.75,4.81 10.75,10.75s-4.81,10.75 -10.75,10.75s-10.75,-4.81 -10.75,-10.75c0,-1.1 0.16,-2.16 0.47,-3.17c0.84,1.87 2.72,3.17 4.9,3.17c2.97,0 5.37,-2.41 5.37,-5.37c0,-2.18 -1.3,-4.06 -3.17,-4.9c1,-0.31 2.06,-0.47 3.17,-0.47z"/></svg>',
            '        <span class="moonfin-sidebar-label">Seerr</span>',
            '    </button>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-cast' + (!settings.showCastButton ? ' hidden' : '') + '" data-action="cast" title="Cast">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 24 24"><path d="M1 18v3h3c0-1.66-1.34-3-3-3m0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7m0-4v2a9 9 0 0 1 9 9h2c0-6.08-4.93-11-11-11m20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2"/></svg>',
            '        <span class="moonfin-sidebar-label">Cast</span>',
            '    </button>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-syncplay' + (!settings.showSyncPlayButton ? ' hidden' : '') + '" data-action="syncplay" title="SyncPlay">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 -960 960 960"><path d="M0-240v-63q0-43 44-70t116-27q13 0 25 .5t23 2.5q-14 21-21 44t-7 48v65H0Zm240 0v-65q0-32 17.5-58.5T307-410q32-20 76.5-30t96.5-10q53 0 97.5 10t76.5 30q32 20 49 46.5t17 58.5v65H240Zm540 0v-65q0-26-6.5-49T754-397q11-2 22.5-2.5t23.5-.5q72 0 116 26.5t44 70.5v63H780Zm-455-80h311q-10-20-55.5-35T480-370q-55 0-100.5 15T325-320ZM160-440q-33 0-56.5-23.5T80-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T160-440Zm640 0q-33 0-56.5-23.5T720-520q0-34 23.5-57t56.5-23q34 0 57 23t23 57q0 33-23 56.5T800-440Zm-320-40q-50 0-85-35t-35-85q0-51 35-85.5t85-34.5q51 0 85.5 34.5T600-600q0 50-34.5 85T480-480Zm0-80q17 0 28.5-11.5T520-600q0-17-11.5-28.5T480-640q-17 0-28.5 11.5T440-600q0 17 11.5 28.5T480-560Zm1 240Zm-1-280Z"/></svg>',
            '        <span class="moonfin-sidebar-label">SyncPlay</span>',
            '    </button>',
            '',
            '    <div class="moonfin-sidebar-separator"></div>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-libraries-toggle' + (!settings.showLibrariesInToolbar ? ' hidden' : '') + '" data-action="libraries-toggle" title="Libraries">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 24 24"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z"/></svg>',
            '        <span class="moonfin-sidebar-label">Libraries</span>',
            '        <svg class="moonfin-sidebar-chevron" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>',
            '    </button>',
            '    <div class="moonfin-sidebar-libraries">',
            '    </div>',
            '',
            '    <div class="moonfin-sidebar-separator"></div>',
            '',
            '    <button class="moonfin-sidebar-item moonfin-sidebar-settings" data-action="settings" title="Settings">',
            '        <svg class="moonfin-sidebar-icon" viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>',
            '        <span class="moonfin-sidebar-label">Settings</span>',
            '    </button>',
            '',
            '</div>',
            '',
            '<div class="moonfin-sidebar-footer">',
            '    <div class="moonfin-sidebar-clock' + (!settings.showClock ? ' hidden' : '') + '">',
            '        <span>--:--</span>',
            '    </div>',
            '</div>'
        ].join('\n');

        document.body.insertBefore(this.container, document.body.firstChild);

        this.overlay = document.createElement('div');
        this.overlay.className = 'moonfin-sidebar-overlay';
        document.body.appendChild(this.overlay);

        this.mobileTrigger = document.createElement('button');
        this.mobileTrigger.className = 'moonfin-sidebar-mobile-trigger';
        this.mobileTrigger.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>';
        this.mobileTrigger.title = 'Menu';
        document.body.appendChild(this.mobileTrigger);

        var sidebarBack = document.createElement('button');
        sidebarBack.className = 'moonfin-details-sidebar-back';
        sidebarBack.innerHTML = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>';
        sidebarBack.title = 'Back';
        sidebarBack.style.display = 'none';
        sidebarBack.addEventListener('click', function() {
            if (typeof Details !== 'undefined' && Details.isVisible) Details.goBack();
        });
        document.body.appendChild(sidebarBack);

        document.body.classList.add('moonfin-sidebar-active');
    },

    async loadUserData() {
        this.currentUser = await API.getCurrentUser();
        if (this.currentUser) {
            this.updateUserAvatar();
        }

        this.libraries = await API.getUserViews();
        this.updateLibraries();
    },

    updateUserAvatar() {
        var avatarContainer = this.container.querySelector('.moonfin-sidebar-avatar');
        var usernameEl = this.container.querySelector('.moonfin-sidebar-username');
        if (!avatarContainer || !this.currentUser) return;

        var avatarUrl = API.getUserAvatarUrl(this.currentUser);
        if (avatarUrl) {
            avatarContainer.innerHTML = '<img src="' + avatarUrl + '" alt="' + (this.currentUser.Name || '') + '">';
        } else {
            var initial = (this.currentUser.Name && this.currentUser.Name[0]) || 'U';
            avatarContainer.innerHTML = '<span class="moonfin-sidebar-initial">' + initial + '</span>';
        }

        if (usernameEl) {
            usernameEl.textContent = this.currentUser.Name || 'User';
        }
    },

    updateLibraries() {
        var librariesList = this.container.querySelector('.moonfin-sidebar-libraries');
        if (!librariesList) return;

        librariesList.innerHTML = this.libraries.map(function(lib) {
            var collectionType = lib.CollectionType || '';
            return '<button class="moonfin-sidebar-library-item" data-action="library" data-library-id="' + lib.Id + '" data-collection-type="' + collectionType + '" title="' + lib.Name + '">' +
                lib.Name +
            '</button>';
        }).join('');
    },

    toggleLibraries() {
        this.librariesExpanded = !this.librariesExpanded;

        var toggleBtn = this.container.querySelector('.moonfin-sidebar-libraries-toggle');
        var librariesList = this.container.querySelector('.moonfin-sidebar-libraries');

        if (toggleBtn) {
            toggleBtn.classList.toggle('libraries-expanded', this.librariesExpanded);
        }
        if (librariesList) {
            librariesList.classList.toggle('expanded', this.librariesExpanded);
        }
    },

    toggleMobile() {
        var isExpanded = this.container.classList.contains('expanded');
        this.container.classList.toggle('expanded', !isExpanded);
        this.overlay.classList.toggle('visible', !isExpanded);

        if (isExpanded) {
            this.librariesExpanded = false;
            var toggleBtn = this.container.querySelector('.moonfin-sidebar-libraries-toggle');
            var librariesList = this.container.querySelector('.moonfin-sidebar-libraries');
            if (toggleBtn) toggleBtn.classList.remove('libraries-expanded');
            if (librariesList) librariesList.classList.remove('expanded');
        }
    },

    closeMobile() {
        this.container.classList.remove('expanded');
        this.overlay.classList.remove('visible');
    },

    setupEventListeners() {
        var self = this;

        this.container.addEventListener('click', function(e) {
            var btn = e.target.closest('.moonfin-sidebar-item, .moonfin-sidebar-library-item');
            if (!btn) return;

            var action = btn.dataset.action;
            if (action === 'libraries-toggle') {
                self.toggleLibraries();
                return;
            }

            if (self.isMobile()) {
                self.closeMobile();
            }

            self.handleNavigation(action, btn);
        });

        var userBtn = this.container.querySelector('.moonfin-sidebar-user-btn');
        if (userBtn) {
            userBtn.addEventListener('click', function() {
                if (self.isMobile()) {
                    self.closeMobile();
                }
                if (Genres.isVisible) Genres.close();
                if (Details.isVisible) Details.hide(true);
                API.navigateTo('/mypreferencesmenu');
            });
        }

        if (this.mobileTrigger) {
            this.mobileTrigger.addEventListener('click', function() {
                self.toggleMobile();
            });
        }

        if (this.overlay) {
            this.overlay.addEventListener('click', function() {
                self.closeMobile();
            });
        }

        this._onSettingsChanged = function(e) {
            self.applySettings(e.detail);
        };
        this._onViewShow = function() {
            self.updateActiveState();
        };
        this._onJellyseerrConfig = function(e) {
            self.updateJellyseerrButton(e.detail);
        };

        window.addEventListener('moonfin-settings-changed', this._onSettingsChanged);
        window.addEventListener('viewshow', this._onViewShow);
        window.addEventListener('moonfin-jellyseerr-config', this._onJellyseerrConfig);
    },

    updateJellyseerrButton(config) {
        var btn = this.container ? this.container.querySelector('.moonfin-sidebar-jellyseerr') : null;
        if (!btn) return;

        if (config && config.enabled && config.url) {
            btn.classList.remove('hidden');
            var label = btn.querySelector('.moonfin-sidebar-label');
            if (label) {
                label.textContent = config.displayName || 'Seerr';
            }
            btn.title = config.displayName || 'Seerr';
            
            // Swap icon based on variant
            var iconEl = btn.querySelector('.moonfin-sidebar-icon');
            if (iconEl && Jellyseerr.icons) {
                var variant = config.variant || 'seerr';
                var tempDiv = document.createElement('div');
                tempDiv.innerHTML = Jellyseerr.getIcon(variant);
                var newIcon = tempDiv.querySelector('svg');
                if (newIcon) {
                    newIcon.classList.add('moonfin-sidebar-icon');
                    newIcon.classList.remove('moonfin-jellyseerr-icon');
                    iconEl.replaceWith(newIcon);
                }
            }
        } else {
            btn.classList.add('hidden');
        }
    },

    async handleNavigation(action, btn) {
        if (action !== 'settings' && Details.isVisible) {
            Details.hide(true);
        }

        if (action !== 'jellyseerr' && action !== 'settings' && Jellyseerr.isOpen) {
            Jellyseerr.close();
            this.updateJellyseerrButtonState();
        }

        if (action !== 'genres' && action !== 'settings' && Genres.isVisible) {
            Genres.close();
        }

        if (action !== 'library' && action !== 'settings' && Library.isVisible) {
            Library.close();
        }

        switch (action) {
            case 'home':
                API.navigateTo('/home');
                break;
            case 'search':
                API.navigateTo('/search');
                break;
            case 'shuffle':
                await this.handleShuffle();
                break;
            case 'genres':
                if (Genres.isVisible) {
                    Genres.close();
                } else {
                    Genres.show();
                }
                break;
            case 'favorites':
                API.navigateTo('/home?tab=1');
                break;
            case 'settings':
                Settings.show();
                break;
            case 'cast':
                this.showCastMenu(btn);
                break;
            case 'syncplay':
                this.showSyncPlayMenu(btn);
                break;
            case 'jellyseerr':
                Jellyseerr.toggle();
                this.updateJellyseerrButtonState();
                break;
            case 'library':
                var libraryId = btn.dataset.libraryId;
                var collectionType = btn.dataset.collectionType;
                var libraryName = btn.getAttribute('title');
                if (libraryId) {
                    var type = (collectionType || '').toLowerCase();
                    if (type !== 'livetv') {
                        Library.show(libraryId, libraryName, collectionType);
                    } else {
                        API.navigateTo(this.getLibraryUrl(libraryId, collectionType));
                    }
                }
                break;
        }
    },

    updateJellyseerrButtonState() {
        var btn = this.container ? this.container.querySelector('.moonfin-sidebar-jellyseerr') : null;
        if (btn) {
            btn.classList.toggle('active', Jellyseerr.isOpen);
        }
    },

    getLibraryUrl: function(libraryId, collectionType) {
        var type = (collectionType || '').toLowerCase();
        switch (type) {
            case 'movies':
                return '/movies?topParentId=' + libraryId + '&collectionType=' + collectionType;
            case 'tvshows':
                return '/tv?topParentId=' + libraryId + '&collectionType=' + collectionType;
            case 'music':
                return '/music?topParentId=' + libraryId + '&collectionType=' + collectionType;
            case 'livetv':
                return '/livetv?collectionType=' + collectionType;
            case 'homevideos':
                return '/homevideos?topParentId=' + libraryId;
            case 'books':
                return '/list?parentId=' + libraryId;
            default:
                return '/list?parentId=' + libraryId;
        }
    },

    showCastMenu() {
        var nativeCastBtn = document.querySelector('.headerCastButton, .castButton');
        if (nativeCastBtn) {
            nativeCastBtn.click();
        }
    },

    showSyncPlayMenu() {
        if (Device.isTV()) return;
        if (typeof SyncPlay !== 'undefined') {
            SyncPlay.toggle();
        } else {
            var nativeSyncBtn = document.querySelector('.headerSyncButton, .syncButton');
            if (nativeSyncBtn) {
                nativeSyncBtn.click();
            }
        }
    },

    async handleShuffle() {
        var settings = Storage.getAll();
        var items = await API.getRandomItems({
            contentType: settings.shuffleContentType,
            limit: 1
        });

        if (items.length > 0) {
            var item = items[0];
            if (typeof Details !== 'undefined' && Storage.get('detailsPageEnabled')) {
                Details.showDetails(item.Id, item.Type);
            } else {
                API.navigateToItem(item.Id);
            }
        }
    },

    updateActiveState() {
        if (!this.container) return;

        var path = window.location.pathname + window.location.search;

        this.container.querySelectorAll('.moonfin-sidebar-item').forEach(function(btn) {
            btn.classList.remove('active');
        });

        if (path.indexOf('/home') !== -1) {
            var homeBtn = this.container.querySelector('.moonfin-sidebar-home');
            if (homeBtn) homeBtn.classList.add('active');
        } else if (path.indexOf('/search') !== -1) {
            var searchBtn = this.container.querySelector('.moonfin-sidebar-search');
            if (searchBtn) searchBtn.classList.add('active');
        }

        var urlParams = new URLSearchParams(window.location.search);
        var parentId = urlParams.get('parentId');
        if (parentId) {
            var libraryBtn = this.container.querySelector('[data-library-id="' + parentId + '"]');
            if (libraryBtn) {
                libraryBtn.classList.add('active');
            }
        }
    },

    startClock() {
        var self = this;
        var updateClock = function() {
            var clockElement = self.container ? self.container.querySelector('.moonfin-sidebar-clock span') : null;
            if (!clockElement) return;

            var now = new Date();
            var settings = Storage.getAll();

            var hours = now.getHours();
            var minutes = now.getMinutes();
            var suffix = '';

            if (!settings.use24HourClock) {
                suffix = hours >= 12 ? ' PM' : ' AM';
                hours = hours % 12 || 12;
            }

            clockElement.textContent = hours + ':' + minutes.toString().padStart(2, '0') + suffix;
        };

        updateClock();
        this.clockInterval = setInterval(updateClock, 1000);
    },

    applySettings(settings) {
        if (!this.container) return;

        var shuffleBtn = this.container.querySelector('.moonfin-sidebar-shuffle');
        if (shuffleBtn) shuffleBtn.classList.toggle('hidden', !settings.showShuffleButton);

        var genresBtn = this.container.querySelector('.moonfin-sidebar-genres');
        if (genresBtn) genresBtn.classList.toggle('hidden', !settings.showGenresButton);

        var favoritesBtn = this.container.querySelector('.moonfin-sidebar-favorites');
        if (favoritesBtn) favoritesBtn.classList.toggle('hidden', !settings.showFavoritesButton);

        var librariesToggle = this.container.querySelector('.moonfin-sidebar-libraries-toggle');
        if (librariesToggle) librariesToggle.classList.toggle('hidden', !settings.showLibrariesInToolbar);

        var clock = this.container.querySelector('.moonfin-sidebar-clock');
        if (clock) clock.classList.toggle('hidden', !settings.showClock);
    },

    destroy() {
        if (this.clockInterval) {
            clearInterval(this.clockInterval);
            this.clockInterval = null;
        }
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
        if (this.mobileTrigger) {
            this.mobileTrigger.remove();
            this.mobileTrigger = null;
        }
        if (this._onSettingsChanged) {
            window.removeEventListener('moonfin-settings-changed', this._onSettingsChanged);
            this._onSettingsChanged = null;
        }
        if (this._onViewShow) {
            window.removeEventListener('viewshow', this._onViewShow);
            this._onViewShow = null;
        }
        if (this._onJellyseerrConfig) {
            window.removeEventListener('moonfin-jellyseerr-config', this._onJellyseerrConfig);
            this._onJellyseerrConfig = null;
        }
        document.body.classList.remove('moonfin-sidebar-active');
        this.librariesExpanded = false;
        this.initialized = false;
    }
};


// === components/mediabar.js ===
var MediaBar = {
    container: null,
    initialized: false,
    items: [],
    currentIndex: 0,
    isPaused: false,
    autoAdvanceTimer: null,
    isVisible: true,

    _trailerState: 'idle',
    _trailerPlayer: null,
    _trailerRevealTimer: null,
    _trailerVideoId: null,
    _sponsorSegments: [],
    _trailerRevealMs: 4000,
    _ytApiReady: false,
    _ytApiLoading: false,

    async init() {
        var settings = Storage.getAll();
        var desktopProvider = String((Storage.getProfile('desktop') || {}).desktopMediaBarProvider || '').toLowerCase();
        var enabled = settings.mediaBarEnabled || desktopProvider === 'moonfin';
        if (!enabled) {
            document.body.classList.remove('moonfin-mediabar-active');
            return;
        }

        if (this.initialized) return;

        this.createMediaBar();
        this.container.classList.add('loading');

        if (Plugin.isHomePage()) {
            document.body.classList.add('moonfin-mediabar-active');
        } else {
            this.container.classList.add('hidden');
        }

        this.setupEventListeners();
        this.initialized = true;

        // Track current content settings to avoid redundant reloads
        this._lastItemCount = settings.mediaBarItemCount;
        this._lastSourceType = settings.mediaBarSourceType;
        this._lastCollectionIds = settings.mediaBarCollectionIds;
        this._lastLibraryIds = settings.mediaBarLibraryIds;
        this._lastExcludedGenres = settings.mediaBarExcludedGenres;

        this._loadContentAsync(settings);
    },

    _loadContentAsync(settings) {
        var self = this;
        this.waitForApi().then(function() {
            return self.loadContent();
        }).then(function() {
            self.container.classList.remove('loading');
            if (self.items.length > 0) {
                if (settings.mediaBarAutoAdvance) {
                    self.startAutoAdvance();
                }
            } else {
                document.body.classList.remove('moonfin-mediabar-active');
                self.container.classList.add('empty');
            }
        }).catch(function(e) {
            console.error('[Moonfin] MediaBar: Failed to load content -', e.message);
            if (self.container) self.container.classList.remove('loading');
            document.body.classList.remove('moonfin-mediabar-active');
            if (self.container) self.container.classList.add('empty');
        });
    },

    waitForApi() {
        return new Promise(function(resolve, reject) {
            var attempts = 0;
            var maxAttempts = 50;
            
            var check = function() {
                var api = API.getApiClient();
                if (api) {
                    try {
                        var userId = api.getCurrentUserId();
                        if (userId) {
                            resolve();
                            return;
                        }
                    } catch (e) {
                        // Not authenticated yet
                    }
                }
                
                if (attempts >= maxAttempts) {
                    reject(new Error('API timeout'));
                } else {
                    attempts++;
                    setTimeout(check, 100);
                }
            };
            check();
        });
    },

    createMediaBar() {
        var existing = document.querySelector('.moonfin-mediabar');
        if (existing) {
            existing.remove();
        }

        var settings = Storage.getAll();
        var overlayColor = Storage.getColorRgba(settings.mediaBarOverlayColor, settings.mediaBarOpacity);

        this.container = document.createElement('div');
        this.container.className = 'moonfin-mediabar';
        this.container.innerHTML =
            '<div class="moonfin-mediabar-backdrop">' +
                '<div class="moonfin-mediabar-backdrop-img moonfin-mediabar-backdrop-current"></div>' +
                '<div class="moonfin-mediabar-backdrop-img moonfin-mediabar-backdrop-next"></div>' +
            '</div>' +
            '<div class="moonfin-mediabar-trailer-container"></div>' +
            '<div class="moonfin-mediabar-gradient"></div>' +
            '<div class="moonfin-mediabar-content">' +
                '<div class="moonfin-mediabar-logo-container">' +
                    '<img class="moonfin-mediabar-logo" src="" alt="">' +
                '</div>' +
                '<div class="moonfin-mediabar-info" style="background: ' + overlayColor + '">' +
                    '<div class="moonfin-mediabar-metadata">' +
                        '<span class="moonfin-mediabar-year"></span>' +
                        '<span class="moonfin-mediabar-rating-badge"></span>' +
                        '<span class="moonfin-mediabar-runtime"></span>' +
                        '<span class="moonfin-mediabar-genres"></span>' +
                    '</div>' +
                    '<div class="moonfin-mediabar-ratings"></div>' +
                    '<div class="moonfin-mediabar-overview"></div>' +
                '</div>' +
            '</div>' +
            '<div class="moonfin-mediabar-nav">' +
                '<button class="moonfin-mediabar-nav-btn moonfin-mediabar-prev" style="background: ' + overlayColor + '">' +
                    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' +
                '</button>' +
                '<button class="moonfin-mediabar-nav-btn moonfin-mediabar-next" style="background: ' + overlayColor + '">' +
                    '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z"/></svg>' +
                '</button>' +
            '</div>' +
            '<div class="moonfin-mediabar-dots-wrap" style="background: ' + overlayColor + '">' +
                '<div class="moonfin-mediabar-dots"></div>' +
            '</div>';

        document.body.appendChild(this.container);
    },

    async loadContent() {
        this.items = await API.getMediaBarItems(Device.getProfileName()) || [];
        this.currentIndex = 0;

        if (this.items.length > 0) {
            this.container.classList.remove('empty');
            if (Plugin.isHomePage()) {
                document.body.classList.add('moonfin-mediabar-active');
            }
            this.updateDisplay();
            this.updateDots();
        } else {
            this.container.classList.add('empty');
            document.body.classList.remove('moonfin-mediabar-active');
        }
    },

    updateDisplay() {
        var item = this.items[this.currentIndex];
        if (!item) return;

        this.stopTrailer();

        var backdropUrl = API.getImageUrl(item, 'Backdrop', { maxWidth: 1920 });
        this.updateBackdrop(backdropUrl);

        var logoUrl = API.getImageUrl(item, 'Logo', { maxWidth: 500 });
        var logoContainer = this.container.querySelector('.moonfin-mediabar-logo-container');
        var logoImg = this.container.querySelector('.moonfin-mediabar-logo');
        
        if (logoUrl) {
            logoImg.src = logoUrl;
            logoImg.alt = item.Name;
            logoContainer.classList.remove('hidden');
        } else {
            logoContainer.classList.add('hidden');
        }

        var yearEl = this.container.querySelector('.moonfin-mediabar-year');
        var ratingBadge = this.container.querySelector('.moonfin-mediabar-rating-badge');
        var runtimeEl = this.container.querySelector('.moonfin-mediabar-runtime');
        var genresEl = this.container.querySelector('.moonfin-mediabar-genres');
        var ratingsEl = this.container.querySelector('.moonfin-mediabar-ratings');
        var overviewEl = this.container.querySelector('.moonfin-mediabar-overview');

        yearEl.textContent = item.ProductionYear || '';

        if (item.OfficialRating) {
            ratingBadge.textContent = item.OfficialRating;
            ratingBadge.classList.remove('hidden');
        } else {
            ratingBadge.textContent = '';
            ratingBadge.classList.add('hidden');
        }

        if (item.RunTimeTicks) {
            var minutes = Math.round(item.RunTimeTicks / 600000000);
            var hours = Math.floor(minutes / 60);
            var mins = minutes % 60;
            runtimeEl.textContent = hours > 0 ? hours + 'h ' + mins + 'm' : mins + 'm';
        } else {
            runtimeEl.textContent = '';
        }

        if (item.Genres && item.Genres.length > 0) {
            genresEl.textContent = item.Genres.slice(0, 3).join(' \u2022 ');
        } else {
            genresEl.textContent = '';
        }

        var ratingParts = [];
        if (item.CommunityRating) {
            ratingParts.push('\u2605 ' + item.CommunityRating.toFixed(1));
        }
        if (item.CriticRating) {
            ratingParts.push('\uD83C\uDF45 ' + item.CriticRating + '%');
        }
        ratingsEl.textContent = ratingParts.join('  \u2022  ');

        if (MdbList.isEnabled()) {
            var currentIdx = this.currentIndex;
            MdbList.fetchRatings(item).then(function(mdbRatings) {
                if (MediaBar.currentIndex !== currentIdx) return;
                if (mdbRatings && mdbRatings.length > 0) {
                    var mdbHtml = MdbList.buildRatingsHtml(mdbRatings, 'compact');
                    if (mdbHtml) {
                        ratingsEl.innerHTML = mdbHtml;
                    }
                }
            });
        }

        if (item.Overview) {
            var tmp = document.createElement('div');
            tmp.innerHTML = item.Overview;
            overviewEl.textContent = tmp.textContent || tmp.innerText || '';
        } else {
            overviewEl.textContent = '';
        }

        this.updateActiveDot();

        var settings = Storage.getAll();
        if (settings.mediaBarTrailerPreview) {
            var currentIdx = this.currentIndex;
            this.fetchAndPlayTrailer(item, currentIdx);
        }
    },

    async fetchAndPlayTrailer(item, expectedIndex) {
        if (item.RemoteTrailers) {
            var videoId = this.extractYouTubeId(item.RemoteTrailers);
            if (videoId && this.currentIndex === expectedIndex) {
                this.startTrailerPreview(videoId);
            }
            return;
        }

        var trailers = await API.getItemTrailers(item.Id);
        if (this.currentIndex !== expectedIndex) return;
        item.RemoteTrailers = trailers;
        var videoId = this.extractYouTubeId(trailers);
        if (videoId) {
            this.startTrailerPreview(videoId);
        }
    },

    extractYouTubeId(trailers) {
        if (!trailers || trailers.length === 0) return null;

        for (var i = 0; i < trailers.length; i++) {
            var url = trailers[i].Url || trailers[i].url || '';
            var match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            if (match) return match[1];
        }
        return null;
    },

    startTrailerPreview(videoId) {
        var self = this;
        this._trailerState = 'resolving';
        this._trailerVideoId = videoId;

        this._ensureYTApi(function() {
            if (self._trailerState !== 'resolving' || self._trailerVideoId !== videoId) return;
            self.fetchSponsorSegments(videoId).then(function(segments) {
                self._sponsorSegments = segments;
                self._loadYTPlayer(videoId);
            }).catch(function() {
                self._sponsorSegments = [];
                self._loadYTPlayer(videoId);
            });
        });
    },

    _ensureYTApi(callback) {
        if (this._ytApiReady && window.YT && window.YT.Player) {
            callback();
            return;
        }
        var self = this;
        if (!this._ytApiLoading) {
            this._ytApiLoading = true;
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        }
        var checkInterval = setInterval(function() {
            if (window.YT && window.YT.Player) {
                clearInterval(checkInterval);
                self._ytApiReady = true;
                self._ytApiLoading = false;
                callback();
            }
        }, 100);
        setTimeout(function() { clearInterval(checkInterval); }, 10000);
    },

    _loadYTPlayer(videoId) {
        if (this._trailerState !== 'resolving') return;

        var self = this;
        var startTime = this.getTrailerStartTime(this._sponsorSegments);
        var trailerContainer = this.container.querySelector('.moonfin-mediabar-trailer-container');

        if (this._trailerPlayer) {
            try { this._trailerPlayer.destroy(); } catch(e) {}
            this._trailerPlayer = null;
        }

        var playerDiv = document.createElement('div');
        playerDiv.id = 'moonfin-yt-player-' + Date.now();
        playerDiv.className = 'moonfin-mediabar-trailer-iframe';
        trailerContainer.innerHTML = '';
        trailerContainer.appendChild(playerDiv);

        this._trailerState = 'playing';
        this.stopAutoAdvance();

        try {
            this._trailerPlayer = new YT.Player(playerDiv.id, {
                videoId: videoId,
                playerVars: {
                    autoplay: 1,
                    mute: 1,
                    controls: 0,
                    start: Math.floor(startTime),
                    rel: 0,
                    modestbranding: 1,
                    playsinline: 1,
                    showinfo: 0,
                    iv_load_policy: 3,
                    disablekb: 1,
                    fs: 0,
                    origin: window.location.origin
                },
                events: {
                    onReady: function(event) {
                        event.target.mute();
                        event.target.playVideo();
                        self._trailerRevealTimer = setTimeout(function() {
                            if (self._trailerState === 'playing') {
                                var iframe = trailerContainer.querySelector('iframe');
                                if (iframe) iframe.classList.add('visible');
                                self.container.classList.add('trailer-active');
                            }
                        }, self._trailerRevealMs);
                    },
                    onStateChange: function(event) {
                        if (event.data === 0) {
                            self.stopTrailer();
                        }
                    },
                    onError: function(event) {
                        console.warn('[Moonfin] MediaBar: YouTube player error:', event.data);
                        self._trailerState = 'unavailable';
                        self.stopTrailer();
                    }
                }
            });
        } catch(e) {
            console.warn('[Moonfin] MediaBar: Failed to create YouTube player:', e);
            this._trailerState = 'unavailable';
        }
    },

    fetchSponsorSegments(videoId) {
        return new Promise(function(resolve) {
            var url = 'https://sponsor.ajay.app/api/skipSegments?videoID=' + videoId +
                      '&categories=["sponsor","selfpromo","intro","outro","interaction","music_offtopic"]';
            
            fetch(url).then(function(resp) {
                if (!resp.ok) { resolve([]); return; }
                return resp.json();
            }).then(function(data) {
                if (!Array.isArray(data)) { resolve([]); return; }
                var segments = [];
                for (var i = 0; i < data.length; i++) {
                    if (data[i].segment && data[i].segment.length === 2) {
                        segments.push({ start: data[i].segment[0], end: data[i].segment[1] });
                    }
                }
                resolve(segments);
            }).catch(function() {
                resolve([]);
            });
        });
    },

    getTrailerStartTime(segments) {
        var startTime = 0;
        if (!segments || segments.length === 0) return startTime;

        var sorted = segments.slice().sort(function(a, b) { return a.start - b.start; });
        for (var i = 0; i < sorted.length; i++) {
            if (sorted[i].start <= startTime + 1) {
                startTime = Math.max(startTime, sorted[i].end);
            }
        }
        return Math.max(startTime, 5);
    },

    stopTrailer() {
        if (this._trailerRevealTimer) {
            clearTimeout(this._trailerRevealTimer);
            this._trailerRevealTimer = null;
        }

        if (this.container) this.container.classList.remove('trailer-active');

        if (this._trailerPlayer) {
            try { this._trailerPlayer.destroy(); } catch(e) {}
            this._trailerPlayer = null;
        }

        var trailerContainer = this.container ? this.container.querySelector('.moonfin-mediabar-trailer-container') : null;
        if (trailerContainer) trailerContainer.innerHTML = '';

        this._trailerState = 'idle';
        this._trailerVideoId = null;
        this._sponsorSegments = [];

        if (!this.isPaused) {
            var settings = Storage.getAll();
            if (settings.mediaBarAutoAdvance && !this.autoAdvanceTimer) {
                this.startAutoAdvance();
            }
        }
    },

    updateBackdrop(url) {
        var current = this.container.querySelector('.moonfin-mediabar-backdrop-current');
        var next = this.container.querySelector('.moonfin-mediabar-backdrop-next');

        if (!url) {
            current.style.backgroundImage = '';
            return;
        }

        if (this._crossfadeTimer) {
            clearTimeout(this._crossfadeTimer);
            this._crossfadeTimer = null;
        }

        var img = new Image();
        var self = this;
        var doSwap = function() {
            next.style.transition = 'none';
            next.classList.remove('active');
            next.style.backgroundImage = "url('" + url + "')";

            void next.offsetWidth;
            next.style.transition = '';
            next.classList.add('active');

            self._crossfadeTimer = setTimeout(function() {
                current.style.backgroundImage = "url('" + url + "')";
                next.style.transition = 'none';
                next.classList.remove('active');
                void next.offsetWidth;
                next.style.transition = '';
                self._crossfadeTimer = null;
            }, 500);
        };

        img.onload = doSwap;
        img.onerror = doSwap;
        setTimeout(function() {
            if (!img.complete) doSwap();
        }, 300);
        img.src = url;

        this.preloadAdjacent();
    },

    preloadAdjacent() {
        if (!this.items || this.items.length < 2) return;
        var nextIdx = (this.currentIndex + 1) % this.items.length;
        var prevIdx = (this.currentIndex - 1 + this.items.length) % this.items.length;
        var nextUrl = API.getImageUrl(this.items[nextIdx], 'Backdrop', { maxWidth: 1920 });
        var prevUrl = API.getImageUrl(this.items[prevIdx], 'Backdrop', { maxWidth: 1920 });
        if (nextUrl) { var i1 = new Image(); i1.src = nextUrl; }
        if (prevUrl) { var i2 = new Image(); i2.src = prevUrl; }
    },

    updateDots() {
        var dotsContainer = this.container.querySelector('.moonfin-mediabar-dots');
        var html = '';
        for (var i = 0; i < this.items.length; i++) {
            html += '<button class="moonfin-mediabar-dot' + (i === this.currentIndex ? ' active' : '') + '" data-index="' + i + '"></button>';
        }
        dotsContainer.innerHTML = html;
    },

    updateActiveDot() {
        var dots = this.container.querySelectorAll('.moonfin-mediabar-dot');
        for (var i = 0; i < dots.length; i++) {
            dots[i].classList.toggle('active', i === this.currentIndex);
        }
    },

    nextSlide() {
        this.currentIndex = (this.currentIndex + 1) % this.items.length;
        this.updateDisplay();
        this.resetAutoAdvance();
    },

    prevSlide() {
        this.currentIndex = (this.currentIndex - 1 + this.items.length) % this.items.length;
        this.updateDisplay();
        this.resetAutoAdvance();
    },

    goToSlide(index) {
        if (index >= 0 && index < this.items.length) {
            this.currentIndex = index;
            this.updateDisplay();
            this.resetAutoAdvance();
        }
    },

    togglePause() {
        this.isPaused = !this.isPaused;
        this.container.classList.toggle('paused', this.isPaused);

        if (this.isPaused) {
            this.stopAutoAdvance();
        } else {
            this.startAutoAdvance();
        }
    },

    startAutoAdvance() {
        var self = this;
        var settings = Storage.getAll();
        if (!settings.mediaBarAutoAdvance) return;

        this.autoAdvanceTimer = setInterval(function() {
            if (!self.isPaused && self.isVisible && self._trailerState === 'idle') {
                self.nextSlide();
            }
        }, settings.mediaBarIntervalMs);
    },

    stopAutoAdvance() {
        if (this.autoAdvanceTimer) {
            clearInterval(this.autoAdvanceTimer);
            this.autoAdvanceTimer = null;
        }
    },

    resetAutoAdvance() {
        this.stopAutoAdvance();
        if (!this.isPaused) {
            this.startAutoAdvance();
        }
    },

    ensureInDOM() {
        if (this.container && !document.body.contains(this.container)) {

            document.body.appendChild(this.container);
        }
    },

    setupEventListeners() {
        var self = this;

        this.container.querySelector('.moonfin-mediabar-prev').addEventListener('click', function(e) {
            e.stopPropagation();
            self.prevSlide();
        });

        this.container.querySelector('.moonfin-mediabar-next').addEventListener('click', function(e) {
            e.stopPropagation();
            self.nextSlide();
        });

        this.container.querySelector('.moonfin-mediabar-dots').addEventListener('click', function(e) {
            e.stopPropagation();
            var dot = e.target.closest('.moonfin-mediabar-dot');
            if (dot) {
                self.goToSlide(parseInt(dot.dataset.index, 10));
            }
        });

        this.container.addEventListener('click', function(e) {
            if (e.target.closest('.moonfin-mediabar-nav-btn, .moonfin-mediabar-dots, .moonfin-mediabar-dots-wrap')) {
                return;
            }
            var item = self.items[self.currentIndex];
            if (item) {
                if (Storage.get('detailsPageEnabled')) {
                    Details.showDetails(item.Id, item.Type);
                } else {
                    API.navigateToItem(item.Id);
                }
            }
        });

        var touchStartX = 0;
        var touchStartY = 0;
        var touchMoved = false;

        this.container.addEventListener('touchstart', function(e) {
            var touch = e.touches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
            touchMoved = false;
        }, { passive: true });

        this.container.addEventListener('touchmove', function(e) {
            if (!touchStartX) return;
            var dx = Math.abs(e.touches[0].clientX - touchStartX);
            var dy = Math.abs(e.touches[0].clientY - touchStartY);
            if (dx > 10 || dy > 10) touchMoved = true;
            if (dx > dy && dx > 10) e.preventDefault();
        }, { passive: false });

        this.container.addEventListener('touchend', function(e) {
            if (!touchMoved) { touchStartX = 0; return; }
            var dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) >= 50) {
                if (dx < 0) self.nextSlide();
                else self.prevSlide();
            }
            touchStartX = 0;
            touchMoved = false;
        }, { passive: true });

        this.container.addEventListener('keydown', function(e) {
            switch (e.key) {
                case 'ArrowLeft': self.prevSlide(); e.preventDefault(); break;
                case 'ArrowRight': self.nextSlide(); e.preventDefault(); break;
                case ' ': self.togglePause(); e.preventDefault(); break;
                case 'Enter':
                    var item = self.items[self.currentIndex];
                    if (item) {
                        if (Storage.get('detailsPageEnabled')) {
                            Details.showDetails(item.Id, item.Type);
                        } else {
                            API.navigateToItem(item.Id);
                        }
                    }
                    e.preventDefault();
                    break;
            }
        });

        this.container.addEventListener('mouseenter', function() {
            self.container.classList.add('focused');
        });

        this.container.addEventListener('mouseleave', function() {
            self.container.classList.remove('focused');
        });

        document.addEventListener('visibilitychange', function() {
            self.isVisible = !document.hidden;
            if (document.hidden) {
                self.stopTrailer();
            }
        });

        window.addEventListener('moonfin-settings-changed', function(e) {
            self.applySettings(e.detail);
        });
    },

    applySettings(settings) {
        if (!this.container) return;

        if (!settings.mediaBarEnabled) {
            this.hide();
            return;
        } else {
            this.show();
        }

        var overlayColor = Storage.getColorRgba(settings.mediaBarOverlayColor, settings.mediaBarOpacity);

        var infoBox = this.container.querySelector('.moonfin-mediabar-info');
        if (infoBox) infoBox.style.background = overlayColor;

        this.container.querySelectorAll('.moonfin-mediabar-nav-btn').forEach(function(btn) {
            btn.style.background = overlayColor;
        });

        var dotsWrap = this.container.querySelector('.moonfin-mediabar-dots-wrap');
        if (dotsWrap) dotsWrap.style.background = overlayColor;

        this.updateDots();
        this.resetAutoAdvance();

        if (!settings.mediaBarTrailerPreview) {
            this.stopTrailer();
        }

        if (this._lastItemCount !== settings.mediaBarItemCount ||
            this._lastSourceType !== settings.mediaBarSourceType ||
            JSON.stringify(this._lastCollectionIds) !== JSON.stringify(settings.mediaBarCollectionIds) ||
            JSON.stringify(this._lastLibraryIds) !== JSON.stringify(settings.mediaBarLibraryIds) ||
            JSON.stringify(this._lastExcludedGenres) !== JSON.stringify(settings.mediaBarExcludedGenres)) {
            this._lastItemCount = settings.mediaBarItemCount;
            this._lastSourceType = settings.mediaBarSourceType;
            this._lastCollectionIds = settings.mediaBarCollectionIds;
            this._lastLibraryIds = settings.mediaBarLibraryIds;
            this._lastExcludedGenres = settings.mediaBarExcludedGenres;
            this.loadContent();
        }
    },

    show() {
        if (this.container) {
            this.container.classList.remove('disabled');
            if (Plugin.isHomePage() && this.items && this.items.length > 0) {
                document.body.classList.add('moonfin-mediabar-active');
            }
        }
    },

    hide() {
        if (this.container) {
            this.container.classList.add('disabled');
            document.body.classList.remove('moonfin-mediabar-active');
            this.stopTrailer();
        }
    },

    async refresh() {
        this.currentIndex = 0;
        await this.loadContent();
    },

    destroy() {
        this.stopAutoAdvance();
        this.stopTrailer();
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        document.body.classList.remove('moonfin-mediabar-active');
        this.initialized = false;
        this.items = [];
        this.currentIndex = 0;
    }
};


// === components/genres.js ===
var Genres = {
    container: null,
    isVisible: false,
    currentView: 'grid',
    genres: [],
    selectedGenre: null,
    browseItems: [],
    browseTotalCount: 0,
    sortBy: 'SortName',
    sortOrder: 'Ascending',
    filterType: 'all',
    libraryFilterId: 'all',
    libraryFilterOptions: [
        { key: 'all', label: 'All Libraries' }
    ],
    startLetter: null,
    loading: false,
    browseLoading: false,
    browseStartIndex: 0,
    imageSize: 'medium',
    imageType: 'poster',
    gridDirection: 'vertical',
    showSettingsPanel: false,

    SORT_OPTIONS: [
        { key: 'SortName,Ascending', label: 'Name (A-Z)' },
        { key: 'SortName,Descending', label: 'Name (Z-A)' },
        { key: 'CommunityRating,Descending', label: 'Rating' },
        { key: 'DateCreated,Descending', label: 'Date Added' },
        { key: 'PremiereDate,Descending', label: 'Release Date' },
        { key: 'Random,Ascending', label: 'Random' }
    ],

    FILTER_OPTIONS: [
        { key: 'all', label: 'All' },
        { key: 'Movie', label: 'Movies' },
        { key: 'Series', label: 'TV Shows' }
    ],

    LETTERS: ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],

    BATCH_SIZE: 60,

    init: function() {
        this.createContainer();
    },

    createContainer: function() {
        var existing = document.querySelector('.moonfin-genres-overlay');
        if (existing) existing.remove();

        this.container = document.createElement('div');
        this.container.className = 'moonfin-genres-overlay';
        document.body.appendChild(this.container);
    },

    show: function() {
        if (!this.container) this.createContainer();

        var stored = this.getStoredViewPrefs();
        this.imageSize = stored.imageSize || 'medium';
        this.imageType = stored.imageType || 'poster';
        this.gridDirection = stored.gridDirection || 'vertical';
        this.showSettingsPanel = false;

        this.currentView = 'grid';
        this.selectedGenre = null;
        this.isVisible = true;
        this.container.classList.add('visible');
        document.body.classList.add('moonfin-genres-visible');
        document.body.style.overflow = 'hidden';
        history.pushState({ moonfinGenres: true }, '');
        if (window.Moonfin && window.Moonfin.Plugin) window.Moonfin.Plugin._overlayHistoryDepth++;
        else if (typeof Plugin !== 'undefined') Plugin._overlayHistoryDepth++;

        this.loadLibraryFilterOptions();
        this.loadGenres();
    },

    hide: function() {
        if (this.currentView === 'browse') {
            this.showGrid();
            return;
        }

        this.isVisible = false;
        this.container.classList.remove('visible');
        document.body.classList.remove('moonfin-genres-visible');
        document.body.style.overflow = '';
        try { history.back(); } catch(e) {}
    },

    close: function() {
        this.isVisible = false;
        if (this.container) this.container.classList.remove('visible');
        document.body.classList.remove('moonfin-genres-visible');
        document.body.style.overflow = '';
    },

    async loadLibraryFilterOptions() {
        try {
            var views = await API.getUserViews();
            var opts = [{ key: 'all', label: 'All Libraries' }];
            for (var i = 0; i < views.length; i++) {
                var view = views[i] || {};
                var ct = (view.CollectionType || '').toLowerCase();
                if (ct === 'movies' || ct === 'tvshows') {
                    opts.push({ key: view.Id, label: view.Name || 'Library' });
                }
            }
            this.libraryFilterOptions = opts;
        } catch (e) {
            this.libraryFilterOptions = [{ key: 'all', label: 'All Libraries' }];
        }
    },

    showGrid: function() {
        this.currentView = 'grid';
        this.selectedGenre = null;
        this.showSettingsPanel = false;
        this.renderGrid();
    },

    getStoredViewPrefs: function() {
        try {
            var raw = localStorage.getItem('moonfin_genres_view');
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    },

    saveViewPrefs: function() {
        try {
            localStorage.setItem('moonfin_genres_view', JSON.stringify({
                imageSize: this.imageSize,
                imageType: this.imageType,
                gridDirection: this.gridDirection
            }));
        } catch (e) {}
    },

    capitalize: function(s) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    },

    getCardShapeClass: function(item) {
        if (this.imageType === 'thumbnail') return 'type-landscape';
        if (this.imageType === 'banner') return 'type-banner';
        if (this.imageType === 'square' || (item && (item.Type === 'MusicAlbum' || item.Type === 'MusicArtist' || item.Type === 'Audio'))) {
            return 'type-square';
        }
        return 'type-poster';
    },

    getPosterHeight: function() {
        if (this.imageType === 'square') {
            return this.imageSize === 'small' ? 140 : (this.imageSize === 'large' ? 240 : 180);
        }
        if (this.imageType === 'thumbnail' || this.imageType === 'banner') {
            return this.imageSize === 'small' ? 120 : (this.imageSize === 'large' ? 210 : 160);
        }
        return this.imageSize === 'small' ? 200 : (this.imageSize === 'large' ? 350 : 270);
    },

    getNextImageType: function(type) {
        return type === 'poster' ? 'thumbnail' : (type === 'thumbnail' ? 'banner' : (type === 'banner' ? 'square' : 'poster'));
    },

    getAdaptiveGridClass: function() {
        var directionClass = this.gridDirection === 'horizontal' ? 'moonfin-grid-horizontal' : 'moonfin-grid-vertical';
        var typeClass = this.imageType === 'thumbnail' ? 'type-landscape' : (this.imageType === 'banner' ? 'type-banner' : (this.imageType === 'square' ? 'type-square' : 'type-poster'));
        return 'moonfin-genres-adaptive-grid ' + directionClass + ' size-' + this.imageSize + ' ' + typeClass;
    },

    renderSettingsPanel: function() {
        if (!this.showSettingsPanel) return '';
        var html = '';
        html += '<div class="moonfin-library-panel-overlay" data-action="close-settings-panel">';
        html += '  <div class="moonfin-library-side-panel" data-stop-prop="1">';
        html += '    <div class="moonfin-library-settings-header">GENRES</div>';
        html += '    <h2 class="moonfin-library-panel-title">View Settings</h2>';
        html += '    <button class="moonfin-library-setting-row" data-action="cycle-image-size"><span>Image size</span><b>' + this.capitalize(this.imageSize) + '</b></button>';
        html += '    <button class="moonfin-library-setting-row" data-action="cycle-image-type"><span>Image type</span><b>' + this.capitalize(this.imageType) + '</b></button>';
        html += '    <button class="moonfin-library-setting-row" data-action="cycle-grid-direction"><span>Grid direction</span><b>' + this.capitalize(this.gridDirection) + '</b></button>';
        html += '  </div>';
        html += '</div>';
        return html;
    },

    async loadGenres() {
        this.loading = true;
        this.renderGrid();

        try {
            var genreList = await API.getGenres();
            if (!genreList || genreList.length === 0) {
                this.genres = [];
                this.loading = false;
                this.renderGrid();
                return;
            }

            var self = this;
            var enriched = [];
            var batchSize = 8;

            for (var i = 0; i < genreList.length; i += batchSize) {
                var batch = genreList.slice(i, i + batchSize);
                var promises = batch.map(function(genre) {
                    return API.getGenreItems(genre.Name, {
                        limit: 3,
                        sortBy: 'Random',
                        includeItemTypes: 'Movie,Series'
                    }).then(function(result) {
                        var backdropUrl = null;
                        var items = result.Items || [];
                        for (var j = 0; j < items.length; j++) {
                            backdropUrl = API.getBackdropUrl(items[j], { maxWidth: 780, quality: 80 });
                            if (backdropUrl) break;
                        }
                        return {
                            id: genre.Id,
                            name: genre.Name,
                            itemCount: result.TotalRecordCount || 0,
                            backdropUrl: backdropUrl
                        };
                    }).catch(function() {
                        return {
                            id: genre.Id,
                            name: genre.Name,
                            itemCount: 0,
                            backdropUrl: null
                        };
                    });
                });

                var batchResults = await Promise.all(promises);
                enriched = enriched.concat(batchResults);
            }

            enriched.sort(function(a, b) { return a.name.localeCompare(b.name); });
            self.genres = enriched;
            self.loading = false;
            self.renderGrid();
        } catch (e) {
            console.error('[Moonfin] Failed to load genres:', e);
            this.loading = false;
            this.genres = [];
            this.renderGrid();
        }
    },

    renderGrid: function() {
        if (!this.container) return;

        var self = this;
        var html = '';

        html += '<div class="moonfin-genres-header moonfin-genres-main-header">';
        html += '  <div class="moonfin-genres-header-actions">';
        html += '    <button class="moonfin-genres-header-btn" data-action="home" title="Home"><span class="material-icons">home</span></button>';
        html += '    <button class="moonfin-genres-header-btn" data-action="toggle-settings-panel" title="Settings"><span class="material-icons">settings</span></button>';
        html += '  </div>';
        html += '  <div class="moonfin-genres-title-section">';
        html += '    <h1 class="moonfin-genres-title">Genres</h1>';
        html += '    <span class="moonfin-genres-count">' + this.genres.length + ' genres</span>';
        html += '  </div>';
        html += '</div>';

        if (this.loading) {
            html += '<div class="moonfin-genres-loading"><div class="moonfin-genres-spinner"></div></div>';
        } else if (this.genres.length === 0) {
            html += '<div class="moonfin-genres-empty">No genres found</div>';
        } else {
            html += '<div class="moonfin-genres-grid ' + this.getAdaptiveGridClass() + '">';
            for (var i = 0; i < this.genres.length; i++) {
                var genre = this.genres[i];
                var shapeClass = this.getCardShapeClass(null);
                html += '<div class="moonfin-genre-card moonfin-genre-item-card ' + shapeClass + ' size-' + this.imageSize + '" data-genre-index="' + i + '">';
                html += '  <div class="moonfin-genre-backdrop">';
                if (genre.backdropUrl) {
                    html += '    <img class="moonfin-genre-backdrop-img" src="' + genre.backdropUrl + '" alt="" loading="lazy">';
                } else {
                    html += '    <div class="moonfin-genre-backdrop-placeholder"></div>';
                }
                html += '    <div class="moonfin-genre-backdrop-overlay"></div>';
                html += '  </div>';
                html += '  <div class="moonfin-genre-info">';
                html += '    <div class="moonfin-genre-name">' + genre.name + '</div>';
                if (genre.itemCount > 0) {
                    html += '    <div class="moonfin-genre-item-count">' + genre.itemCount + ' items</div>';
                }
                html += '  </div>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += this.renderSettingsPanel();

        this.container.innerHTML = html;
        this.bindGridEvents();
    },

    bindGridEvents: function() {
        var self = this;

        if (this._gridClickHandler) {
            this.container.removeEventListener('click', this._gridClickHandler);
            this._gridClickHandler = null;
        }

        this._gridClickHandler = function(e) {
            if (e.target.closest('[data-stop-prop="1"]') && !e.target.closest('[data-action]')) return;

            var target = e.target.closest('[data-action], .moonfin-genre-card, .moonfin-library-panel-overlay');
            if (!target) return;

            var action = target.getAttribute('data-action');
            if (!action && target.classList.contains('moonfin-genre-card')) {
                var index = parseInt(target.dataset.genreIndex, 10);
                var genre = self.genres[index];
                if (genre) self.openGenre(genre);
                return;
            }

            switch (action) {
                case 'home':
                    self.close();
                    API.navigateTo('/home');
                    break;
                case 'toggle-settings-panel':
                    self.showSettingsPanel = !self.showSettingsPanel;
                    self.renderGrid();
                    break;
                case 'close-settings-panel':
                    self.showSettingsPanel = false;
                    self.renderGrid();
                    break;
                case 'cycle-image-size':
                    self.imageSize = self.imageSize === 'small' ? 'medium' : (self.imageSize === 'medium' ? 'large' : 'small');
                    self.saveViewPrefs();
                    self.renderGrid();
                    break;
                case 'cycle-image-type':
                    self.imageType = self.getNextImageType(self.imageType);
                    self.saveViewPrefs();
                    self.renderGrid();
                    break;
                case 'cycle-grid-direction':
                    self.gridDirection = self.gridDirection === 'vertical' ? 'horizontal' : 'vertical';
                    self.saveViewPrefs();
                    self.renderGrid();
                    break;
            }
        };
        this.container.addEventListener('click', this._gridClickHandler);

        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }
        this._escHandler = function(e) {
            if (e.key === 'Escape' && self.isVisible) {
                e.preventDefault();
                e.stopPropagation();
                self.hide();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    },

    openGenre: function(genre) {
        this.currentView = 'browse';
        this.selectedGenre = genre;
        this.browseItems = [];
        this.browseTotalCount = 0;
        this.browseStartIndex = 0;
        this.sortBy = 'SortName';
        this.sortOrder = 'Ascending';
        this.filterType = 'all';
        this.libraryFilterId = 'all';
        this.startLetter = null;
        this.showSettingsPanel = false;
        this._mdbCache = {};

        this.loadBrowseItems(true);
    },

    async loadBrowseItems(isReset) {
        if (isReset) {
            this.browseStartIndex = 0;
            this.browseItems = [];
            this.browseLoading = true;
            this.renderBrowse();
        }

        var includeItemTypes = this.filterType === 'all' ? 'Movie,Series' : this.filterType;
        var options = {
            startIndex: this.browseStartIndex,
            limit: this.BATCH_SIZE,
            sortBy: this.sortBy,
            sortOrder: this.sortOrder,
            includeItemTypes: includeItemTypes
        };

        if (this.libraryFilterId && this.libraryFilterId !== 'all') {
            options.parentId = this.libraryFilterId;
        }

        if (this.startLetter) {
            if (this.startLetter === '#') {
                options.nameLessThan = 'A';
            } else {
                options.nameStartsWith = this.startLetter;
            }
        }

        try {
            var result = await API.getGenreItems(this.selectedGenre.name, options);
            this.browseTotalCount = result.TotalRecordCount || 0;

            if (isReset) {
                this.browseItems = result.Items || [];
            } else {
                this.browseItems = this.browseItems.concat(result.Items || []);
            }

            this.browseLoading = false;
            this.renderBrowse();
        } catch (e) {
            console.error('[Moonfin] Failed to load browse items:', e);
            this.browseLoading = false;
            this.renderBrowse();
        }
    },

    renderBrowse: function() {
        if (!this.container) return;
        var self = this;

        var currentSortKey = this.sortBy + ',' + this.sortOrder;
        var currentSort = this.SORT_OPTIONS.find(function(o) { return o.key === currentSortKey; });
        var currentLibrary = this.libraryFilterOptions.find(function(o) { return o.key === self.libraryFilterId; });

        var html = '';

        html += '<div class="moonfin-genres-header moonfin-genres-browse-header">';
        html += '  <div class="moonfin-genres-header-actions moonfin-genres-header-actions-left">';
        html += '    <button class="moonfin-genres-header-btn" data-action="back" title="Back"><span class="material-icons">arrow_back</span></button>';
        html += '    <button class="moonfin-genres-toolbar-btn" data-action="sort">';
        html += '      <span class="material-icons">sort</span>';
        html += '      <span>' + (currentSort ? currentSort.label : 'Sort') + '</span>';
        html += '    </button>';
        html += '    <button class="moonfin-genres-toolbar-btn" data-action="library-filter">';
        html += '      <span class="material-icons">video_library</span>';
        html += '      <span>' + (currentLibrary ? currentLibrary.label : 'All Libraries') + '</span>';
        html += '    </button>';
        html += '    <button class="moonfin-genres-header-btn" data-action="toggle-settings-panel" title="Settings"><span class="material-icons">settings</span></button>';
        html += '  </div>';
        html += '  <div class="moonfin-genres-title-section">';
        html += '    <h1 class="moonfin-genres-title">' + this.selectedGenre.name + '</h1>';
        html += '    <span class="moonfin-genres-count">' + this.browseTotalCount + ' items</span>';
        html += '  </div>';
        html += '</div>';

        html += '<div class="moonfin-genres-letter-bar">';
        for (var i = 0; i < this.LETTERS.length; i++) {
            var letter = this.LETTERS[i];
            var activeClass = this.startLetter === letter ? ' active' : '';
            html += '<button class="moonfin-genres-letter-btn' + activeClass + '" data-letter="' + letter + '">' + letter + '</button>';
        }
        html += '</div>';

        if (this.browseLoading && this.browseItems.length === 0) {
            html += '<div class="moonfin-genres-loading"><div class="moonfin-genres-spinner"></div></div>';
        } else if (this.browseItems.length === 0) {
            html += '<div class="moonfin-genres-empty">No items found</div>';
        } else {
            html += '<div class="moonfin-genres-browse-grid ' + this.getAdaptiveGridClass() + '">';
            for (var j = 0; j < this.browseItems.length; j++) {
                var item = this.browseItems[j];
                var shapeClass = this.getCardShapeClass(item);
                var imageType = this.imageType === 'thumbnail' ? 'Thumb' : (this.imageType === 'banner' ? 'Banner' : 'Primary');
                var posterUrl = imageType === 'Thumb'
                    ? (item.ImageTags && item.ImageTags.Thumb ? API.getImageUrl(item, 'Thumb', { maxWidth: 500 }) : null)
                    : (imageType === 'Banner'
                        ? (item.ImageTags && item.ImageTags.Banner ? API.getImageUrl(item, 'Banner', { maxWidth: 500 }) : null)
                        : API.getPrimaryImageUrl(item, { maxWidth: 500 }));
                if (!posterUrl) {
                    posterUrl = API.getBackdropUrl(item, { maxWidth: 500 });
                }
                var year = item.ProductionYear || '';
                var rating = item.CommunityRating ? item.CommunityRating.toFixed(1) : '';
                var officialRating = item.OfficialRating || '';
                var typeLabel = item.Type === 'Movie' ? 'MOVIE' : item.Type === 'Series' ? 'SERIES' : '';

                html += '<div class="moonfin-genre-item-card ' + shapeClass + ' size-' + this.imageSize + '" data-item-id="' + item.Id + '">';
                html += '  <div class="moonfin-genre-item-poster" style="height:' + this.getPosterHeight() + 'px">';
                if (posterUrl) {
                    html += '    <img src="' + posterUrl + '" alt="' + (item.Name || '').replace(/"/g, '&quot;') + '" loading="lazy">';
                } else {
                    html += '    <div class="moonfin-genre-item-no-poster"><span class="material-icons">movie</span></div>';
                }
                if (typeLabel) {
                    html += '    <span class="moonfin-genre-item-type-badge ' + (item.Type === 'Movie' ? 'movie' : 'series') + '">' + typeLabel + '</span>';
                }
                html += '  </div>';
                html += '  <div class="moonfin-genre-item-info">';
                html += '    <div class="moonfin-genre-item-name">' + (item.Name || 'Unknown') + '</div>';
                html += '    <div class="moonfin-genre-item-meta">';
                if (year) html += '<span>' + year + '</span>';
                if (officialRating) html += '<span class="moonfin-genre-item-meta-cert">' + officialRating + '</span>';
                if (rating) html += '<span class="moonfin-genre-item-meta-rating">&#9733; ' + rating + '</span>';
                if (!year && !officialRating && !rating) html += '<span class="moonfin-genre-item-meta-empty">&nbsp;</span>';
                html += '    </div>';
                html += '    <div class="moonfin-genre-item-mdblist moonfin-mdblist-ratings-row"></div>';
                html += '  </div>';
                html += '</div>';
            }

            if (this.browseItems.length < this.browseTotalCount) {
                html += '<div class="moonfin-genres-load-more" data-action="load-more">';
                html += '  <button class="moonfin-genres-toolbar-btn">Load More</button>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += this.renderSettingsPanel();

        this.container.innerHTML = html;
        this.bindBrowseEvents();
    },

    bindBrowseEvents: function() {
        var self = this;

        if (this._gridClickHandler) {
            this.container.removeEventListener('click', this._gridClickHandler);
            this._gridClickHandler = null;
        }

        var itemCards = this.container.querySelectorAll('.moonfin-genre-item-card');
        for (var i = 0; i < itemCards.length; i++) {
            (function(card) {
                card.addEventListener('click', function() {
                    var itemId = this.dataset.itemId;
                    if (itemId) {
                        if (typeof Details !== 'undefined' && Storage.get('detailsPageEnabled')) {
                            Details.showDetails(itemId);
                        } else {
                            API.navigateToItem(itemId);
                            self.isVisible = false;
                            self.container.classList.remove('visible');
                            document.body.classList.remove('moonfin-genres-visible');
                            document.body.style.overflow = '';
                        }
                    }
                });

                if (typeof MdbList !== 'undefined' && MdbList.isEnabled()) {
                    card.addEventListener('mouseenter', function() {
                        var itemId = card.dataset.itemId;
                        var item = null;
                        for (var k = 0; k < self.browseItems.length; k++) {
                            if (self.browseItems[k].Id === itemId) { item = self.browseItems[k]; break; }
                        }
                        if (!item) return;

                        var mdbDiv = card.querySelector('.moonfin-genre-item-mdblist');
                        if (!mdbDiv) return;

                        if (self._mdbCache && self._mdbCache[itemId] !== undefined) {
                            mdbDiv.innerHTML = self._mdbCache[itemId];
                            return;
                        }

                        MdbList.fetchRatings(item).then(function(ratings) {
                            var html = MdbList.buildRatingsHtml(ratings, 'compact') || '';
                            self._mdbCache[itemId] = html;
                            if (card.matches(':hover')) {
                                mdbDiv.innerHTML = html;
                            }
                        });
                    });

                    card.addEventListener('mouseleave', function() {
                        var mdbDiv = card.querySelector('.moonfin-genre-item-mdblist');
                        if (mdbDiv) mdbDiv.innerHTML = '';
                    });
                }
            })(itemCards[i]);
        }

        var sortBtn = this.container.querySelector('[data-action="sort"]');
        if (sortBtn) sortBtn.addEventListener('click', function() { self.showSortMenu(); });

        var backBtn = this.container.querySelector('[data-action="back"]');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                self.showGrid();
            });
        }

        var settingsBtn = this.container.querySelector('[data-action="toggle-settings-panel"]');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', function() {
                self.showSettingsPanel = !self.showSettingsPanel;
                self.renderBrowse();
            });
        }

        var closePanel = this.container.querySelector('[data-action="close-settings-panel"]');
        if (closePanel) {
            closePanel.addEventListener('click', function() {
                self.showSettingsPanel = false;
                self.renderBrowse();
            });
        }

        var cycleImageSize = this.container.querySelector('[data-action="cycle-image-size"]');
        if (cycleImageSize) {
            cycleImageSize.addEventListener('click', function() {
                self.imageSize = self.imageSize === 'small' ? 'medium' : (self.imageSize === 'medium' ? 'large' : 'small');
                self.saveViewPrefs();
                self.renderBrowse();
            });
        }

        var cycleImageType = this.container.querySelector('[data-action="cycle-image-type"]');
        if (cycleImageType) {
            cycleImageType.addEventListener('click', function() {
                self.imageType = self.getNextImageType(self.imageType);
                self.saveViewPrefs();
                self.renderBrowse();
            });
        }

        var cycleGridDirection = this.container.querySelector('[data-action="cycle-grid-direction"]');
        if (cycleGridDirection) {
            cycleGridDirection.addEventListener('click', function() {
                self.gridDirection = self.gridDirection === 'vertical' ? 'horizontal' : 'vertical';
                self.saveViewPrefs();
                self.renderBrowse();
            });
        }

        var libraryFilterBtn = this.container.querySelector('[data-action="library-filter"]');
        if (libraryFilterBtn) {
            libraryFilterBtn.addEventListener('click', function() { self.showLibraryFilterMenu(); });
        }

        var letterBtns = this.container.querySelectorAll('.moonfin-genres-letter-btn');
        for (var j = 0; j < letterBtns.length; j++) {
            letterBtns[j].addEventListener('click', function() {
                var letter = this.dataset.letter;
                self.startLetter = self.startLetter === letter ? null : letter;
                self.loadBrowseItems(true);
            });
        }

        var loadMoreBtn = this.container.querySelector('[data-action="load-more"]');
        if (loadMoreBtn) {
            loadMoreBtn.addEventListener('click', function() {
                self.browseStartIndex = self.browseItems.length;
                self.loadBrowseItems(false);
            });
        }

        var browseGrid = this.container.querySelector('.moonfin-genres-browse-grid');
        if (browseGrid) {
            if (this._scrollHandler) {
                this.container.removeEventListener('scroll', this._scrollHandler);
                this._scrollHandler = null;
            }

            this._scrollHandler = function() {
                if (self.browseLoading) return;
                if (self.browseItems.length >= self.browseTotalCount) return;

                var scrollTop = self.container.scrollTop;
                var scrollHeight = self.container.scrollHeight;
                var clientHeight = self.container.clientHeight;

                if (scrollTop + clientHeight >= scrollHeight - 400) {
                    self.browseStartIndex = self.browseItems.length;
                    self.loadBrowseItems(false);
                }
            };
            this.container.addEventListener('scroll', this._scrollHandler);
        }

        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }
        this._escHandler = function(e) {
            if (e.key === 'Escape' && self.isVisible) {
                e.preventDefault();
                e.stopPropagation();
                self.hide();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    },

    showSortMenu: function() {
        this.showDropdownMenu('Sort By', this.SORT_OPTIONS, this.sortBy + ',' + this.sortOrder, function(key) {
            var parts = key.split(',');
            this.sortBy = parts[0];
            this.sortOrder = parts[1];
            this.loadBrowseItems(true);
        }.bind(this));
    },

    showLibraryFilterMenu: function() {
        this.showDropdownMenu('Library', this.libraryFilterOptions, this.libraryFilterId, function(key) {
            this.libraryFilterId = key;
            this.loadBrowseItems(true);
        }.bind(this));
    },

    showDropdownMenu: function(title, options, activeKey, onSelect) {
        var existing = document.querySelector('.moonfin-genres-dropdown');
        if (existing) existing.remove();

        var dropdown = document.createElement('div');
        dropdown.className = 'moonfin-genres-dropdown';

        var html = '<div class="moonfin-genres-dropdown-backdrop"></div>';
        html += '<div class="moonfin-genres-dropdown-content">';
        html += '<div class="moonfin-genres-dropdown-title">' + title + '</div>';
        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            var isActive = Array.isArray(activeKey) ? activeKey.indexOf(opt.key) !== -1 : opt.key === activeKey;
            var activeClass = isActive ? ' active' : '';
            html += '<button class="moonfin-genres-dropdown-option' + activeClass + '" data-key="' + opt.key + '">' + opt.label + '</button>';
        }
        html += '</div>';
        dropdown.innerHTML = html;

        document.body.appendChild(dropdown);

        dropdown.querySelector('.moonfin-genres-dropdown-backdrop').addEventListener('click', function() {
            dropdown.remove();
        });
        var optBtns = dropdown.querySelectorAll('.moonfin-genres-dropdown-option');
        for (var j = 0; j < optBtns.length; j++) {
            optBtns[j].addEventListener('click', function() {
                var key = this.dataset.key;
                dropdown.remove();
                onSelect(key);
            });
        }

        requestAnimationFrame(function() { dropdown.classList.add('visible'); });
    },

    destroy: function() {
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        if (this._scrollHandler && this.container) {
            this.container.removeEventListener('scroll', this._scrollHandler);
            this._scrollHandler = null;
        }
        if (this._gridClickHandler && this.container) {
            this.container.removeEventListener('click', this._gridClickHandler);
            this._gridClickHandler = null;
        }
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        document.body.classList.remove('moonfin-genres-visible');
        this.isVisible = false;
    }
};


// === components/library.js ===
var Library = {
    container: null,
    isVisible: false,
    libraryId: null,
    libraryName: '',
    collectionType: '',
    items: [],
    totalCount: 0,
    sortKey: 'SortName',
    favoritesOnly: false,
    watchedOnly: false,
    startLetter: null,
    loading: false,
    startIndex: 0,
    imageSize: 'medium',
    imageType: 'poster',
    gridDirection: 'vertical',
    folderView: false,
    folderStack: [],
    focusedItem: null,
    showSortPanel: false,
    showSettingsPanel: false,
    musicContentType: 'albums',
    focusedMdbHtml: '',
    _focusedMdbToken: 0,
    _loadingToken: 0,
    FAVORITE_INDICATOR_SVG: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z"/></svg>',
    WATCHED_INDICATOR_SVG: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z"/></svg>',

    SORT_OPTIONS: [
        { key: 'SortName', field: 'SortName', order: 'Ascending', label: 'Name' },
        { key: 'DateCreated', field: 'DateCreated', order: 'Descending', label: 'Date Added' },
        { key: 'PremiereDate', field: 'PremiereDate', order: 'Descending', label: 'Premiere Date' },
        { key: 'OfficialRating', field: 'OfficialRating', order: 'Ascending', label: 'Rating' },
        { key: 'CommunityRating', field: 'CommunityRating', order: 'Descending', label: 'Community Rating' },
        { key: 'CriticRating', field: 'CriticRating', order: 'Descending', label: 'Critic Rating' },
        { key: 'DatePlayed', field: 'DatePlayed', order: 'Descending', label: 'Last Played' },
        { key: 'Runtime', field: 'Runtime', order: 'Ascending', label: 'Runtime' }
    ],

    MUSIC_SORT_OPTIONS: [
        { key: 'SortName', field: 'SortName', order: 'Ascending', label: 'Name' },
        { key: 'DateCreated', field: 'DateCreated', order: 'Descending', label: 'Date Added' },
        { key: 'CommunityRating', field: 'CommunityRating', order: 'Descending', label: 'Community Rating' },
        { key: 'DatePlayed', field: 'DatePlayed', order: 'Descending', label: 'Last Played' },
        { key: 'AlbumArtist', field: 'AlbumArtist,SortName', order: 'Ascending', label: 'Album Artist' }
    ],

    MUSIC_CONTENT_TYPES: [
        { key: 'albums', label: 'Albums', itemType: 'MusicAlbum' },
        { key: 'artists', label: 'Artists', itemType: 'MusicArtist' }
    ],

    LETTERS: ['#', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],

    BATCH_SIZE: 150,

    init: function() {
        this.createContainer();
        this.setupHomeTileInterception();
    },

    _resolveLibraryName: function(card, libraryId) {
        if (card) {
            var nameEl = card.querySelector('.cardText-first, .cardText, .listItemBodyText');
            if (nameEl) {
                var name = nameEl.textContent.trim();
                if (name) return name;
            }
        }
        var libs = (Navbar.initialized && Navbar.libraries) ||
                   (Sidebar.initialized && Sidebar.libraries) || [];
        for (var i = 0; i < libs.length; i++) {
            if (libs[i].Id === libraryId) return libs[i].Name || 'Library';
        }
        return 'Library';
    },

    setupHomeTileInterception: function() {
        var ignoreSelectors = '.videoOsdBottom, .videoOsdTop, .osdHeader, .videoOsd, .subtitleAppearanceDialog, .subtitleSync, .trackSelections, .playerStats, .dialog, .dialogContainer, .focuscontainer-down, .actionSheetContent, .actionSheet, .actionSheetScroller, .videoPlayerContainer, .upNextContainer, .mediaSelectionMenu, .slideshowButtonContainer, .btnVideoOsd, .osdMediaInfo, .osdControls, .skipSegmentContainer, .itemContextMenu, .popupContainer, .toast, .guide, .recordingFields, .formDialogContent, .formDialog, .promptDialog, .confirmDialog, .withPopup, .multiSelectMenu, .moonfin-more-menu, .moonfin-settings-panel';

        document.addEventListener('click', function(e) {
            if (Storage.get('libraryPageEnabled') === false) return;
            if (e.target.closest(ignoreSelectors)) return;

            var card = e.target.closest('.card, .listItem, [data-action="link"]');
            if (!card) return;

            var cardType = card.getAttribute('data-type');
            if (cardType !== 'CollectionFolder') return;

            var dataAction = card.getAttribute('data-action');
            if (dataAction && dataAction !== 'link') return;

            var libraryId = card.getAttribute('data-id');
            if (!libraryId) return;

            var collectionType = (card.getAttribute('data-collectiontype') || '').toLowerCase();
            if (collectionType === 'livetv') return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            Library.show(libraryId, Library._resolveLibraryName(card, libraryId), collectionType);
        }, true);
    },

    createContainer: function() {
        var existing = document.querySelector('.moonfin-library-overlay');
        if (existing) existing.remove();

        this.container = document.createElement('div');
        this.container.className = 'moonfin-genres-overlay moonfin-library-overlay';
        document.body.appendChild(this.container);
    },

    show: function(libraryId, libraryName, collectionType, options) {
        if (!this.container) this.createContainer();
        options = options || {};

        this.libraryId = libraryId;
        this.libraryName = libraryName || 'Library';
        this.collectionType = (collectionType || '').toLowerCase();
        this.items = [];
        this.totalCount = 0;
        this.startIndex = 0;
        this.startLetter = null;
        this.loading = false;
        this.focusedItem = null;
        this.showSortPanel = false;
        this.showSettingsPanel = false;
        this.folderStack = [];
        this.focusedMdbHtml = '';
        this._focusedMdbToken = 0;
        this._loadingToken++;

        var stored = this.getStoredViewPrefs();
        this.sortKey = options.sortKey || stored.sortKey || 'SortName';
        this.favoritesOnly = false;
        this.watchedOnly = false;
        this.imageSize = stored.imageSize || 'medium';
        this.imageType = stored.imageType || (this.isSquareDefault() ? 'square' : 'poster');
        this.gridDirection = stored.gridDirection || 'vertical';
        this.folderView = stored.folderView || this.shouldDefaultToFolderView();
        this.musicContentType = stored.musicContentType || 'albums';

        this.isVisible = true;
        this.container.classList.add('visible');
        document.body.classList.add('moonfin-library-visible');
        document.body.style.overflow = 'hidden';
        history.pushState({ moonfinLibrary: true }, '');
        if (window.Moonfin && window.Moonfin.Plugin) window.Moonfin.Plugin._overlayHistoryDepth++;
        else if (typeof Plugin !== 'undefined') Plugin._overlayHistoryDepth++;

        this.loadItems(true);
    },

    hide: function() {
        if (this.showSettingsPanel) {
            this.showSettingsPanel = false;
            this.render();
            return;
        }
        if (this.showSortPanel) {
            this.showSortPanel = false;
            this.render();
            return;
        }
        if (this.folderView && this.folderStack.length > 0) {
            this.folderStack.pop();
            this.loadItems(true);
            return;
        }

        this.isVisible = false;
        if (this.container) this.container.classList.remove('visible');
        document.body.classList.remove('moonfin-library-visible');
        document.body.style.overflow = '';
        try { history.back(); } catch(e) {}
    },

    close: function() {
        this.isVisible = false;
        if (this.container) this.container.classList.remove('visible');
        document.body.classList.remove('moonfin-library-visible');
        document.body.style.overflow = '';
    },

    getStoredViewPrefs: function() {
        try {
            var key = 'moonfin_library_view_' + (this.libraryId || 'default');
            var raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    },

    saveViewPrefs: function() {
        try {
            var key = 'moonfin_library_view_' + (this.libraryId || 'default');
            localStorage.setItem(key, JSON.stringify({
                sortKey: this.sortKey,
                imageSize: this.imageSize,
                imageType: this.imageType,
                gridDirection: this.gridDirection,
                folderView: this.folderView,
                musicContentType: this.musicContentType
            }));
        } catch (e) {}
    },

    isMusicLibrary: function() {
        return this.collectionType === 'music';
    },

    isSquareDefault: function() {
        return this.collectionType === 'music' || this.collectionType === 'playlists';
    },

    shouldDefaultToFolderView: function() {
        return this.collectionType === 'homevideos' || this.collectionType === 'mixed';
    },

    shouldShowImageTypeOption: function() {
        return !this.shouldDefaultToFolderView();
    },

    getCurrentFolderId: function() {
        if (this.folderStack.length > 0) {
            return this.folderStack[this.folderStack.length - 1].id;
        }
        return this.libraryId;
    },

    getActiveSortOptions: function() {
        return this.isMusicLibrary() ? this.MUSIC_SORT_OPTIONS : this.SORT_OPTIONS;
    },

    getSortOption: function() {
        var options = this.getActiveSortOptions();
        for (var i = 0; i < options.length; i++) {
            if (options[i].key === this.sortKey) return options[i];
        }
        return options[0];
    },

    getItemTypeForLibrary: function() {
        switch (this.collectionType) {
            case 'movies':
                return 'Movie';
            case 'tvshows':
                return 'Series';
            case 'boxsets':
                return 'BoxSet';
            case 'collection':
                return '';
            case 'homevideos':
                return 'Video,Photo,PhotoAlbum';
            case 'photos':
                return 'Photo,PhotoAlbum';
            case 'music': {
                for (var i = 0; i < this.MUSIC_CONTENT_TYPES.length; i++) {
                    if (this.MUSIC_CONTENT_TYPES[i].key === this.musicContentType) {
                        return this.MUSIC_CONTENT_TYPES[i].itemType;
                    }
                }
                return 'MusicAlbum';
            }
            case 'musicvideos':
                return 'MusicVideo';
            case 'playlists':
                return 'Playlist';
            case 'books':
                return 'Book';
            case 'trailers':
                return 'Trailer';
            default:
                return '';
        }
    },

    getExcludeItemTypes: function() {
        if (this.collectionType === 'movies' || this.collectionType === 'tvshows') {
            return 'BoxSet';
        }
        return '';
    },

    getFilters: function() {
        var filters = [];
        if (this.favoritesOnly) filters.push('IsFavorite');
        if (this.watchedOnly) filters.push('IsPlayed');
        return filters.join(',');
    },

    async loadItems(isReset) {
        if (this.loading && !isReset) return;

        if (isReset) {
            this.startIndex = 0;
            this.items = [];
            this.render();
        }

        this.loading = true;
        var token = ++this._loadingToken;
        var sortOption = this.getSortOption();

        var params = {
            startIndex: this.startIndex,
            limit: this.BATCH_SIZE,
            sortBy: sortOption.field,
            sortOrder: sortOption.order,
            fields: 'PrimaryImageAspectRatio,ProductionYear,CommunityRating,OfficialRating,CriticRating,RunTimeTicks,Overview,Genres,UserData,SortName,Path,ChildCount,MediaSourceCount,AlbumArtist,ProviderIds',
            recursive: !this.folderView,
            nameStartsWith: this.startLetter && this.startLetter !== '#' ? this.startLetter : null,
            nameLessThan: this.startLetter === '#' ? 'A' : null
        };

        if (this.folderView) {
            params.parentId = this.getCurrentFolderId();
            params.sortBy = 'IsFolder,' + sortOption.field;
        } else if (this.libraryId) {
            params.parentId = this.libraryId;
        }

        var includeItemTypes = this.getItemTypeForLibrary();
        if (includeItemTypes) params.includeItemTypes = includeItemTypes;

        var excludeItemTypes = this.getExcludeItemTypes();
        if (excludeItemTypes) params.excludeItemTypes = excludeItemTypes;

        var filters = this.getFilters();
        if (filters) params.filters = filters;

        try {
            var result = await API.getLibraryItems(this.getCurrentFolderId(), params);
            if (token !== this._loadingToken) return;

            var incoming = result.Items || [];
            if (excludeItemTypes && incoming.length > 0) {
                incoming = incoming.filter(function(item) { return item.Type !== 'BoxSet'; });
            }

            this.totalCount = result.TotalRecordCount || incoming.length;

            if (isReset) {
                this.items = incoming;
            } else {
                var existing = {};
                for (var i = 0; i < this.items.length; i++) existing[this.items[i].Id] = true;
                for (var j = 0; j < incoming.length; j++) {
                    if (!existing[incoming[j].Id]) {
                        this.items.push(incoming[j]);
                        existing[incoming[j].Id] = true;
                    }
                }
            }
        } catch (e) {
            if (token !== this._loadingToken) return;
            console.error('[Moonfin] Failed to load library items:', e);
        }

        this.loading = false;
        this.render();
    },

    getVisibleItems: function() {
        if (!this.startLetter) return this.items;
        var letter = this.startLetter;
        return this.items.filter(function(item) {
            var name = item.Name || '';
            var firstChar = name.charAt(0).toUpperCase();
            if (letter === '#') return !/[A-Z]/.test(firstChar);
            return firstChar === letter;
        });
    },

    getCardShapeClass: function(item) {
        if (this.imageType === 'thumbnail') return 'type-landscape';
        if (this.imageType === 'banner') return 'type-banner';
        if (this.imageType === 'square' || item.Type === 'MusicAlbum' || item.Type === 'MusicArtist' || item.Type === 'Audio') {
            return 'type-square';
        }
        return 'type-poster';
    },

    getPosterHeight: function() {
        if (this.imageType === 'square') {
            return this.imageSize === 'small' ? 140 : (this.imageSize === 'large' ? 240 : 180);
        }
        if (this.imageType === 'thumbnail' || this.imageType === 'banner') {
            return this.imageSize === 'small' ? 120 : (this.imageSize === 'large' ? 210 : 160);
        }
        return this.imageSize === 'small' ? 200 : (this.imageSize === 'large' ? 350 : 270);
    },

    getNextImageType: function(type) {
        return type === 'poster' ? 'thumbnail' : (type === 'thumbnail' ? 'banner' : (type === 'banner' ? 'square' : 'poster'));
    },

    getGridClass: function() {
        var directionClass = this.gridDirection === 'horizontal' ? 'moonfin-library-grid-horizontal' : 'moonfin-library-grid-vertical';
        var typeClass = this.imageType === 'thumbnail' ? 'type-landscape' : (this.imageType === 'banner' ? 'type-banner' : (this.imageType === 'square' ? 'type-square' : 'type-poster'));
        return directionClass + ' size-' + this.imageSize + ' ' + typeClass;
    },

    formatRuntime: function(ticks) {
        if (!ticks) return '';
        var minutes = Math.floor(ticks / 600000000);
        if (minutes < 60) return minutes + 'm';
        var hours = Math.floor(minutes / 60);
        var mins = minutes % 60;
        return mins > 0 ? hours + 'h ' + mins + 'm' : hours + 'h';
    },

    buildFocusedInfoHtml: function() {
        if (!this.focusedItem) return '';
        var item = this.focusedItem;
        var parts = [];
        if (item.ProductionYear) parts.push('<span class="moonfin-library-meta-item">' + item.ProductionYear + '</span>');
        if (item.OfficialRating) parts.push('<span class="moonfin-library-meta-item">' + item.OfficialRating + '</span>');
        var runtime = this.formatRuntime(item.RunTimeTicks);
        if (runtime && item.Type !== 'Series') parts.push('<span class="moonfin-library-meta-item">' + runtime + '</span>');
        if (item.CommunityRating) parts.push('<span class="moonfin-library-meta-item">&#9733; ' + item.CommunityRating.toFixed(1) + '</span>');

        return '<div class="moonfin-library-focused">' +
            '<div class="moonfin-library-focused-name">' + (item.Name || '') + '</div>' +
            '<div class="moonfin-library-focused-meta">' + parts.join('') + '</div>' +
            '<div class="moonfin-library-focused-mdblist moonfin-mdblist-ratings-row">' + (this.focusedMdbHtml || '') + '</div>' +
        '</div>';
    },

    updateFocusedInfoDom: function() {
        if (!this.container) return;
        var focused = this.container.querySelector('.moonfin-library-focused');
        var nextHtml = this.buildFocusedInfoHtml();
        if (!nextHtml) {
            if (focused) focused.remove();
            return;
        }

        if (focused) {
            focused.outerHTML = nextHtml;
        } else {
            var header = this.container.querySelector('.moonfin-library-header');
            if (header) {
                header.insertAdjacentHTML('afterend', nextHtml);
            }
        }
    },

    loadFocusedMdbRatings: function(item) {
        if (!item || typeof MdbList === 'undefined' || !MdbList.isEnabled()) {
            return;
        }

        var token = ++this._focusedMdbToken;
        var self = this;

        MdbList.fetchRatings(item).then(function(ratings) {
            if (token !== self._focusedMdbToken) return;
            if (!self.focusedItem || self.focusedItem.Id !== item.Id) return;

            self.focusedMdbHtml = MdbList.buildRatingsHtml(ratings, 'compact') || '';
            var row = self.container ? self.container.querySelector('.moonfin-library-focused-mdblist') : null;
            if (row) {
                row.innerHTML = self.focusedMdbHtml;
            } else {
                self.updateFocusedInfoDom();
            }
        });
    },

    setFocusedItem: function(item) {
        if (!item) return;
        if (this.focusedItem && this.focusedItem.Id === item.Id) return;

        this.focusedItem = item;
        this.focusedMdbHtml = '';
        this._focusedMdbToken++;
        this.updateFocusedInfoDom();
        this.loadFocusedMdbRatings(item);
    },

    renderSortPanel: function() {
        if (!this.showSortPanel) return '';
        var options = this.getActiveSortOptions();
        var html = '';
        html += '<div class="moonfin-library-panel-overlay" data-action="close-sort-panel">';
        html += '  <div class="moonfin-library-side-panel" data-stop-prop="1">';
        html += '    <h2 class="moonfin-library-panel-title">Sort &amp; Filter</h2>';
        html += '    <div class="moonfin-library-panel-section">';
        html += '      <div class="moonfin-library-panel-label">Sort By</div>';
        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            var active = this.sortKey === opt.key ? ' active' : '';
            html += '<button class="moonfin-library-panel-option' + active + '" data-action="set-sort" data-sort-key="' + opt.key + '">' + opt.label + '</button>';
        }
        html += '    </div>';

        if (this.isMusicLibrary()) {
            html += '    <div class="moonfin-library-panel-section">';
            html += '      <div class="moonfin-library-panel-label">Show</div>';
            for (var m = 0; m < this.MUSIC_CONTENT_TYPES.length; m++) {
                var type = this.MUSIC_CONTENT_TYPES[m];
                var mActive = this.musicContentType === type.key ? ' active' : '';
                html += '<button class="moonfin-library-panel-option' + mActive + '" data-action="set-music-content" data-music-content="' + type.key + '">' + type.label + '</button>';
            }
            html += '    </div>';
        }

        html += '    <div class="moonfin-library-panel-section">';
        html += '      <div class="moonfin-library-panel-label">Filters</div>';
        html += '      <button class="moonfin-library-panel-option' + (this.favoritesOnly ? ' active' : '') + '" data-action="toggle-favorites">Favorites Only</button>';
        html += '      <button class="moonfin-library-panel-option' + (this.watchedOnly ? ' active' : '') + '" data-action="toggle-watched">Watched Only</button>';
        html += '    </div>';
        html += '  </div>';
        html += '</div>';
        return html;
    },

    renderSettingsPanel: function() {
        if (!this.showSettingsPanel) return '';
        var html = '';
        html += '<div class="moonfin-library-panel-overlay" data-action="close-settings-panel">';
        html += '  <div class="moonfin-library-side-panel" data-stop-prop="1">';
        html += '    <div class="moonfin-library-settings-header">LIBRARIES</div>';
        html += '    <h2 class="moonfin-library-panel-title">' + this.libraryName + '</h2>';
        html += '    <button class="moonfin-library-setting-row" data-action="cycle-image-size"><span>Image size</span><b>' + this.capitalize(this.imageSize) + '</b></button>';
        if (this.shouldShowImageTypeOption()) {
            html += '    <button class="moonfin-library-setting-row" data-action="cycle-image-type"><span>Image type</span><b>' + this.capitalize(this.imageType) + '</b></button>';
        }
        html += '    <button class="moonfin-library-setting-row" data-action="cycle-grid-direction"><span>Grid direction</span><b>' + this.capitalize(this.gridDirection) + '</b></button>';
        html += '    <button class="moonfin-library-setting-row" data-action="toggle-folder-view"><span>Folder view</span><b>' + (this.folderView ? 'On' : 'Off') + '</b></button>';
        html += '  </div>';
        html += '</div>';
        return html;
    },

    capitalize: function(s) {
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
    },

    renderBreadcrumb: function() {
        if (!this.folderView || this.folderStack.length === 0) return '';
        var html = '<div class="moonfin-library-breadcrumb">';
        html += '<button class="moonfin-library-breadcrumb-item" data-action="breadcrumb" data-depth="0">' + this.libraryName + '</button>';
        for (var i = 0; i < this.folderStack.length; i++) {
            var seg = this.folderStack[i];
            html += '<span class="moonfin-library-breadcrumb-sep">&#8250;</span>';
            if (i < this.folderStack.length - 1) {
                html += '<button class="moonfin-library-breadcrumb-item" data-action="breadcrumb" data-depth="' + (i + 1) + '">' + seg.name + '</button>';
            } else {
                html += '<span class="moonfin-library-breadcrumb-current">' + seg.name + '</span>';
            }
        }
        html += '</div>';
        return html;
    },

    render: function() {
        if (!this.container) return;
        var visibleItems = this.getVisibleItems();
        var sortOption = this.getSortOption();
        var statusText = this.folderView
            ? 'Browsing folders sorted by ' + sortOption.label
            : 'Showing items from ' + this.libraryName + ' sorted by ' + sortOption.label;

        var html = '';
        html += '<div class="moonfin-genres-header moonfin-library-header">';
        if (this.folderView && this.folderStack.length > 0) {
            html += this.renderBreadcrumb();
            html += '<span class="moonfin-genres-count">' + this.totalCount + ' items</span>';
        } else {
            html += '<div class="moonfin-genres-title-section">';
            html += '  <h1 class="moonfin-genres-title">' + this.libraryName + '</h1>';
            html += '  <span class="moonfin-genres-count">' + this.totalCount + ' items</span>';
            html += '</div>';
        }
        html += '</div>';

        html += this.buildFocusedInfoHtml();

        html += '<div class="moonfin-genres-toolbar moonfin-library-toolbar">';
        html += '  <button class="moonfin-genres-header-btn" data-action="home" title="Home"><span class="material-icons">home</span></button>';
        html += '  <button class="moonfin-genres-header-btn" data-action="toggle-sort-panel" title="Sort"><span class="material-icons">sort</span></button>';
        html += '  <button class="moonfin-genres-header-btn" data-action="toggle-settings-panel" title="Settings"><span class="material-icons">settings</span></button>';
        html += '  <div class="moonfin-genres-letter-nav moonfin-library-letter-nav">';
        for (var i = 0; i < this.LETTERS.length; i++) {
            var letter = this.LETTERS[i];
            html += '<button class="moonfin-genres-letter-btn' + (this.startLetter === letter ? ' active' : '') + '" data-action="letter" data-letter="' + letter + '">' + letter + '</button>';
        }
        html += '  </div>';
        html += '</div>';

        if (this.loading && visibleItems.length === 0) {
            html += '<div class="moonfin-genres-loading"><div class="moonfin-genres-spinner"></div></div>';
        } else if (visibleItems.length === 0) {
            html += '<div class="moonfin-genres-empty">No items found</div>';
        } else {
            html += '<div class="moonfin-genres-browse-grid moonfin-library-grid ' + this.getGridClass() + '" data-action="grid">';
            for (var j = 0; j < visibleItems.length; j++) {
                var item = visibleItems[j];
                var shapeClass = this.getCardShapeClass(item);
                var posterUrl;
                if (this.imageType === 'thumbnail') {
                    posterUrl = item.ImageTags && item.ImageTags.Thumb ? API.getImageUrl(item, 'Thumb', { maxWidth: 500 }) : null;
                } else if (this.imageType === 'banner') {
                    posterUrl = item.ImageTags && item.ImageTags.Banner ? API.getImageUrl(item, 'Banner', { maxWidth: 500 }) : null;
                } else {
                    posterUrl = API.getPrimaryImageUrl(item, { maxWidth: 500 });
                }
                if (!posterUrl) {
                    posterUrl = API.getBackdropUrl(item, { maxWidth: 500 });
                }

                html += '<div class="moonfin-genre-item-card moonfin-library-item-card ' + shapeClass + ' size-' + this.imageSize + '" data-item-id="' + item.Id + '">';
                html += '  <div class="moonfin-genre-item-poster" style="height:' + this.getPosterHeight() + 'px">';
                if (posterUrl) {
                    html += '    <img src="' + posterUrl + '" alt="' + (item.Name || '').replace(/"/g, '&quot;') + '" loading="lazy">';
                } else {
                    html += '    <div class="moonfin-genre-item-no-poster"><span class="material-icons">movie</span></div>';
                }
                if (this.folderView && item.IsFolder) {
                    html += '    <span class="moonfin-library-folder-badge">Folder</span>';
                }
                if (item.UserData && item.UserData.IsFavorite) {
                    html += '    <div class="moonfin-library-favorite-indicator" data-item-id="' + item.Id + '">' + this.FAVORITE_INDICATOR_SVG + '</div>';
                }
                if (item.UserData && item.UserData.Played) {
                    html += '    <div class="moonfin-library-watched-indicator" data-item-id="' + item.Id + '">' + this.WATCHED_INDICATOR_SVG + '</div>';
                }
                html += '  </div>';
                html += '  <div class="moonfin-genre-item-info"><div class="moonfin-genre-item-name">' + (item.Name || 'Unknown') + '</div></div>';
                html += '</div>';
            }
            html += '</div>';
        }

        html += '<div class="moonfin-library-status-bar">';
        html += '<div class="moonfin-library-status-text">' + statusText + '</div>';
        html += '<div class="moonfin-library-status-count">' + visibleItems.length + ' | ' + this.totalCount + '</div>';
        html += '</div>';

        html += this.renderSortPanel();
        html += this.renderSettingsPanel();

        this.container.innerHTML = html;
        this.bindEvents();
    },

    findItemById: function(itemId) {
        for (var i = 0; i < this.items.length; i++) {
            if (this.items[i].Id === itemId) return this.items[i];
        }
        return null;
    },

    handleItemOpen: function(item) {
        if (!item) return;
        if (this.folderView && item.IsFolder) {
            this.folderStack.push({ id: item.Id, name: item.Name || 'Folder' });
            this.loadItems(true);
            return;
        }

        if (item.Type === 'BoxSet' || item.Type === 'Playlist') {
            this.show(item.Id, item.Name || 'Collection', 'collection', { sortKey: 'PremiereDate' });
            return;
        }

        var type = item.Type || null;
        var supportsMoonfinDetails = type === 'Movie' || type === 'Series' || type === 'Episode' || type === 'Season' || type === 'Person';
        if (supportsMoonfinDetails && typeof Details !== 'undefined' && Storage.get('detailsPageEnabled')) {
            Details.showDetails(item.Id, type);
            return;
        }

        API.navigateToItem(item.Id);
        this.close();
    },

    bindEvents: function() {
        var self = this;

        if (this._clickHandler) {
            this.container.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }

        this._clickHandler = function(e) {
            var target = e.target.closest('[data-action], .moonfin-genre-item-card, .moonfin-library-panel-overlay');
            if (!target) return;

            if (target.getAttribute('data-stop-prop') === '1') return;

            var action = target.getAttribute('data-action');
            if (!action && target.classList.contains('moonfin-genre-item-card')) {
                action = 'open-item';
            }

            switch (action) {
                case 'home':
                    self.close();
                    API.navigateTo('/home');
                    break;
                case 'toggle-sort-panel':
                    self.showSortPanel = !self.showSortPanel;
                    self.showSettingsPanel = false;
                    self.render();
                    break;
                case 'toggle-settings-panel':
                    self.showSettingsPanel = !self.showSettingsPanel;
                    self.showSortPanel = false;
                    self.render();
                    break;
                case 'close-sort-panel':
                    self.showSortPanel = false;
                    self.render();
                    break;
                case 'close-settings-panel':
                    self.showSettingsPanel = false;
                    self.render();
                    break;
                case 'set-sort':
                    self.sortKey = target.getAttribute('data-sort-key') || self.sortKey;
                    self.saveViewPrefs();
                    self.showSortPanel = false;
                    self.loadItems(true);
                    break;
                case 'set-music-content':
                    self.musicContentType = target.getAttribute('data-music-content') || self.musicContentType;
                    self.saveViewPrefs();
                    self.loadItems(true);
                    break;
                case 'toggle-favorites':
                    self.favoritesOnly = !self.favoritesOnly;
                    self.loadItems(true);
                    break;
                case 'toggle-watched':
                    self.watchedOnly = !self.watchedOnly;
                    self.loadItems(true);
                    break;
                case 'letter':
                    var letter = target.getAttribute('data-letter');
                    self.startLetter = self.startLetter === letter ? null : letter;
                    self.loadItems(true);
                    break;
                case 'cycle-image-size':
                    self.imageSize = self.imageSize === 'small' ? 'medium' : (self.imageSize === 'medium' ? 'large' : 'small');
                    self.saveViewPrefs();
                    self.render();
                    break;
                case 'cycle-image-type':
                    if (self.shouldShowImageTypeOption()) {
                        self.imageType = self.getNextImageType(self.imageType);
                        self.saveViewPrefs();
                        self.render();
                    }
                    break;
                case 'cycle-grid-direction':
                    self.gridDirection = self.gridDirection === 'vertical' ? 'horizontal' : 'vertical';
                    self.saveViewPrefs();
                    self.render();
                    break;
                case 'toggle-folder-view':
                    self.folderView = !self.folderView;
                    self.folderStack = [];
                    self.saveViewPrefs();
                    self.loadItems(true);
                    break;
                case 'breadcrumb':
                    var depth = parseInt(target.getAttribute('data-depth') || '0', 10);
                    if (!isNaN(depth)) {
                        self.folderStack = self.folderStack.slice(0, Math.max(0, depth));
                        self.loadItems(true);
                    }
                    break;
                case 'open-item':
                    var itemId = target.getAttribute('data-item-id');
                    self.handleItemOpen(self.findItemById(itemId));
                    break;
            }
        };
        this.container.addEventListener('click', this._clickHandler);

        if (this._mouseoverHandler) {
            this.container.removeEventListener('mouseover', this._mouseoverHandler);
            this._mouseoverHandler = null;
        }

        this._mouseoverHandler = function(e) {
            var card = e.target.closest('.moonfin-genre-item-card');
            if (!card || !self.container.contains(card)) return;
            if (e.relatedTarget && card.contains(e.relatedTarget)) return;

            var item = self.findItemById(card.getAttribute('data-item-id'));
            self.setFocusedItem(item);
        };
        this.container.addEventListener('mouseover', this._mouseoverHandler);

        if (this._focusinHandler) {
            this.container.removeEventListener('focusin', this._focusinHandler);
            this._focusinHandler = null;
        }

        this._focusinHandler = function(e) {
            var card = e.target.closest('.moonfin-genre-item-card');
            if (!card || !self.container.contains(card)) return;

            var item = self.findItemById(card.getAttribute('data-item-id'));
            self.setFocusedItem(item);
        };
        this.container.addEventListener('focusin', this._focusinHandler);

        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }

        if (this._scrollHandler) {
            this.container.removeEventListener('scroll', this._scrollHandler);
            this._scrollHandler = null;
        }

        this._scrollHandler = function() {
            if (self.loading) return;
            if (self.startLetter) return;
            if (self.items.length >= self.totalCount) return;
            var scrollTop = self.container.scrollTop;
            var scrollHeight = self.container.scrollHeight;
            var clientHeight = self.container.clientHeight;
            if (scrollTop + clientHeight >= scrollHeight - 400) {
                self.startIndex = self.items.length;
                self.loadItems(false);
            }
        };
        this.container.addEventListener('scroll', this._scrollHandler);

        this._escHandler = function(e) {
            if (e.key === 'Escape' && self.isVisible) {
                e.preventDefault();
                e.stopPropagation();
                self.hide();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    },

    destroy: function() {
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        if (this._scrollHandler && this.container) {
            this.container.removeEventListener('scroll', this._scrollHandler);
            this._scrollHandler = null;
        }
        if (this._clickHandler && this.container) {
            this.container.removeEventListener('click', this._clickHandler);
            this._clickHandler = null;
        }
        if (this._mouseoverHandler && this.container) {
            this.container.removeEventListener('mouseover', this._mouseoverHandler);
            this._mouseoverHandler = null;
        }
        if (this._focusinHandler && this.container) {
            this.container.removeEventListener('focusin', this._focusinHandler);
            this._focusinHandler = null;
        }
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        document.body.classList.remove('moonfin-library-visible');
        this.isVisible = false;
    }
};


// === components/settings.js ===
var Settings = {
    dialog: null,
    isOpen: false,
    _toastTimeout: null,

    _esc: function(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; },

    hasParadoxMediaBar: function() {
        if (window.slideshowPure) return true;
        return !!document.querySelector('script[src*="jellyfin-plugin-media-bar"], script[src*="slideshowpure.js"]');
    },

    getDesktopMediaBarMode: function(profileName, resolved, raw) {
        if (profileName !== 'desktop' || !this.hasParadoxMediaBar()) return null;
        if (raw && raw.desktopMediaBarProvider) {
            var saved = String(raw.desktopMediaBarProvider).toLowerCase();
            if (saved === 'paradox' || saved === 'moonfin' || saved === 'off') return saved;
        }
        return resolved.mediaBarEnabled ? 'moonfin' : 'off';
    },

    toggleMediaBarSettingsVisibility: function(profileName, desktopMode) {
        if (!this.dialog) return;

        var hideMoonfinMediaBarSettings = profileName === 'desktop' && desktopMode === 'paradox';
        var mediaBarSection = this.dialog.querySelector('.moonfin-panel-section[data-section="mediabar"]');

        if (mediaBarSection) mediaBarSection.style.display = hideMoonfinMediaBarSettings ? 'none' : '';
    },

    getHomeRowsSourceLabel: function(source) {
        var normalized = String(source || '').toLowerCase();
        if (normalized === 'hss') return 'Home Screen Sections (HSS)';
        if (normalized === 'kefintweaks') return 'KefinTweaks Rows';
        if (normalized === 'moonfin') return 'Moonfin Custom Rows';
        if (normalized === 'legacy') return 'Legacy Jellyfin Home Order';
        return normalized ? normalized : 'Legacy Jellyfin Home Order';
    },

    renderHomeRowsV2Preview: function(resolved) {
        var rows = resolved && Array.isArray(resolved.homeRowsV2) ? resolved.homeRowsV2 : [];
        if (!rows.length) {
            return '<div class="moonfin-toggle-desc">No custom row payload detected for this profile.</div>';
        }

        var visible = [];
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i] || {};
            if (row.enabled === false) continue;
            visible.push(row);
        }

        if (!visible.length) {
            return '<div class="moonfin-toggle-desc">All custom rows are currently disabled.</div>';
        }

        var sorted = visible.slice().sort(function(a, b) {
            var ao = typeof a.order === 'number' ? a.order : 9999;
            var bo = typeof b.order === 'number' ? b.order : 9999;
            return ao - bo;
        });

        var maxRows = Math.min(sorted.length, 8);
        var items = '';
        for (var ri = 0; ri < maxRows; ri++) {
            var item = sorted[ri] || {};
            var title = item.title || item.id || ('Row ' + (ri + 1));
            var kind = item.kind || 'custom';
            var source = item.source || 'unknown';
            items += '<li><strong>' + this._esc(String(title)) + '</strong> <span class="moonfin-toggle-desc">(' + this._esc(String(kind)) + ' / ' + this._esc(String(source)) + ')</span></li>';
        }

        var more = sorted.length > maxRows
            ? '<div class="moonfin-toggle-desc" style="margin-top:6px">+' + (sorted.length - maxRows) + ' more rows</div>'
            : '';

        return '<ul style="margin:6px 0 0 18px; padding:0;">' + items + '</ul>' + more;
    },

    updateHomeRowsStatus: function(profileName, resolved) {
        if (!this.dialog) return;

        var sourceEl = this.dialog.querySelector('#moonfin-homerows-source');
        var previewEl = this.dialog.querySelector('#moonfin-homerows-v2-preview');
        if (!sourceEl || !previewEl) return;

        var source = (resolved && resolved.homeRowsSource) || ((resolved && resolved.homeRowsV2 && resolved.homeRowsV2.length) ? 'moonfin' : 'legacy');
        sourceEl.textContent = 'Resolved source for ' + profileName + ': ' + this.getHomeRowsSourceLabel(source);
        previewEl.innerHTML = this.renderHomeRowsV2Preview(resolved || {});
    },

    show: function() {
        if (this.isOpen) return;

        this.createDialog();
        // Trigger animation after append
        var self = this;
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                if (self.dialog) {
                    self.dialog.classList.add('open');
                }
            });
        });
        this.isOpen = true;
        history.pushState({ moonfinSettings: true }, '');
        if (window.Moonfin && window.Moonfin.Plugin) window.Moonfin.Plugin._overlayHistoryDepth++;
        else if (typeof Plugin !== 'undefined') Plugin._overlayHistoryDepth++;
    },

    hide: function(skipHistoryBack) {
        if (!this.isOpen) return;
        var self = this;

        this.isOpen = false;

        this.dialog.classList.remove('open');
        setTimeout(function() {
            if (self.dialog) {
                self.dialog.remove();
                self.dialog = null;
            }
        }, 300);

        if (!skipHistoryBack) {
            try { history.back(); } catch(e) {}
        }
    },

    showToast: function(message) {
        var existing = document.querySelector('.moonfin-toast');
        if (existing) existing.remove();

        var toast = document.createElement('div');
        toast.className = 'moonfin-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        requestAnimationFrame(function() {
            toast.classList.add('visible');
        });

        if (this._toastTimeout) clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(function() {
            toast.classList.remove('visible');
            setTimeout(function() { toast.remove(); }, 300);
        }, 2000);
    },

    showSyncModeDialog: function() {
        var self = this;
        return new Promise(function(resolve) {
            if (!self.dialog) {
                resolve(null);
                return;
            }

            var existing = self.dialog.querySelector('.moonfin-sync-choice-backdrop');
            if (existing) existing.remove();

            var backdrop = document.createElement('div');
            backdrop.className = 'moonfin-sync-choice-backdrop';
            backdrop.innerHTML =
                '<div class="moonfin-sync-choice-modal" role="dialog" aria-modal="true" aria-labelledby="moonfin-sync-choice-title">' +
                    '<h3 id="moonfin-sync-choice-title">Choose Sync Direction</h3>' +
                    '<p>Pick how to sync this account\'s Moonfin profiles.</p>' +
                    '<div class="moonfin-sync-choice-actions">' +
                        '<button type="button" class="moonfin-panel-btn moonfin-panel-btn-primary" data-choice="push">Push to Profile</button>' +
                        '<button type="button" class="moonfin-panel-btn moonfin-panel-btn-ghost" data-choice="pull">Pull from Profile</button>' +
                        '<button type="button" class="moonfin-panel-btn moonfin-panel-btn-ghost" data-choice="cancel">Cancel</button>' +
                    '</div>' +
                '</div>';

            var cleanup = function(choice) {
                if (backdrop && backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
                resolve(choice);
            };

            backdrop.addEventListener('click', function(e) {
                if (e.target === backdrop) cleanup(null);
            });

            backdrop.querySelector('[data-choice="push"]').addEventListener('click', function() { cleanup('push'); });
            backdrop.querySelector('[data-choice="pull"]').addEventListener('click', function() { cleanup('pull'); });
            backdrop.querySelector('[data-choice="cancel"]').addEventListener('click', function() { cleanup(null); });

            self.dialog.appendChild(backdrop);
        });
    },

    saveSetting: function(name, value) {
        var profileName = Storage.getActiveEditProfile();
        var profile = Storage.getProfile(profileName);
        profile[name] = value;
        Storage.saveProfile(profileName, profile);
        var safeValue = name.toLowerCase().indexOf('apikey') !== -1 || name.toLowerCase().indexOf('token') !== -1 ? '***' : value;
        console.log('[Moonfin] Setting saved to profile "' + profileName + '":', name, '=', safeValue);
    },

    createToggleCard: function(id, title, description, checked) {
        return '<div class="moonfin-toggle-card">' +
            '<label class="moonfin-toggle-label">' +
                '<input type="checkbox" id="moonfin-' + id + '" name="' + id + '"' + (checked ? ' checked' : '') + '>' +
                '<div class="moonfin-toggle-info">' +
                    '<div class="moonfin-toggle-title">' + title + '</div>' +
                    (description ? '<div class="moonfin-toggle-desc">' + description + '</div>' : '') +
                '</div>' +
            '</label>' +
        '</div>';
    },

    createSelectCard: function(id, title, description, options, currentValue) {
        var optionsHtml = '';
        for (var i = 0; i < options.length; i++) {
            var opt = options[i];
            optionsHtml += '<option value="' + opt.value + '"' + (String(currentValue) === String(opt.value) ? ' selected' : '') + '>' + opt.label + '</option>';
        }

        return '<div class="moonfin-select-card">' +
            '<div class="moonfin-select-info">' +
                '<div class="moonfin-toggle-title">' + title + '</div>' +
                (description ? '<div class="moonfin-toggle-desc">' + description + '</div>' : '') +
            '</div>' +
            '<select id="moonfin-' + id + '" name="' + id + '" class="moonfin-panel-select">' +
                optionsHtml +
            '</select>' +
        '</div>';
    },

    createRangeCard: function(id, title, description, min, max, step, currentValue, suffix) {
        var rangeSuffix = suffix || '';
        return '<div class="moonfin-select-card">' +
            '<div class="moonfin-select-info">' +
                '<div class="moonfin-toggle-title">' + title + ' <span class="moonfin-range-value" data-for="' + id + '" data-suffix="' + rangeSuffix + '">' + currentValue + rangeSuffix + '</span></div>' +
                (description ? '<div class="moonfin-toggle-desc">' + description + '</div>' : '') +
            '</div>' +
            '<input type="range" id="moonfin-' + id + '" name="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + currentValue + '" class="moonfin-panel-range">' +
        '</div>';
    },

    _initSortableList: function(listElement, onSave) {
        var dragItem = null;
        var dragPlaceholder = document.createElement('div');
        dragPlaceholder.className = 'moonfin-sortable-placeholder';

        var collectAndSave = function() {
            var items = listElement.querySelectorAll('.moonfin-sortable-item');
            var enabled = [];
            for (var i = 0; i < items.length; i++) {
                if (items[i].classList.contains('moonfin-sortable-item-active')) {
                    enabled.push(items[i].getAttribute('data-source'));
                }
            }
            onSave(enabled);
        };

        listElement.addEventListener('dragstart', function(e) {
            const interactive = e.target.closest('input, button, select, textarea, a, label');
            const isHandle = !!e.target.closest('.moonfin-sortable-handle');
            if (interactive && !isHandle) {
                e.preventDefault();
                return;
            }
            var item = e.target.closest('.moonfin-sortable-item');
            if (!item) return;
            dragItem = item;
            item.classList.add('moonfin-sortable-dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });

        listElement.addEventListener('dragend', function() {
            if (dragItem) {
                dragItem.classList.remove('moonfin-sortable-dragging');
                dragItem = null;
            }
            if (dragPlaceholder.parentNode) {
                dragPlaceholder.parentNode.removeChild(dragPlaceholder);
            }
        });

        listElement.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            var target = e.target.closest('.moonfin-sortable-item');
            if (!target || target === dragItem) return;

            var rect = target.getBoundingClientRect();
            var midY = rect.top + rect.height / 2;
            if (e.clientY < midY) {
                listElement.insertBefore(dragPlaceholder, target);
            } else {
                listElement.insertBefore(dragPlaceholder, target.nextSibling);
            }
        });

        listElement.addEventListener('drop', function(e) {
            e.preventDefault();
            if (!dragItem) return;
            if (dragPlaceholder.parentNode) {
                listElement.insertBefore(dragItem, dragPlaceholder);
                dragPlaceholder.parentNode.removeChild(dragPlaceholder);
            }
            collectAndSave();
        });

        listElement.addEventListener('click', function(e) {
            var item;
            var checkbox = e.target.closest('.moonfin-sortable-checkbox input[type="checkbox"]');
            if (checkbox) {
                item = checkbox.closest('.moonfin-sortable-item');
                if (!item) return;
                item.classList.toggle('moonfin-sortable-item-active', checkbox.checked);
                collectAndSave();
                return;
            }
            var toggleBtn = e.target.closest('.moonfin-sortable-toggle');
            if (!toggleBtn) return;
            item = toggleBtn.closest('.moonfin-sortable-item');
            if (!item) return;
            var isActive = item.classList.toggle('moonfin-sortable-item-active');
            var svg = toggleBtn.querySelector('path');
            if (svg) {
                svg.setAttribute('d', isActive
                    ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
                    : 'M19 13H5v-2h14v2z');
            }
            toggleBtn.title = isActive ? 'Disable' : 'Enable';
            collectAndSave();
        });

        (function() {
            var touchItem = null;
            var touchClone = null;
            var touchOffsetY = 0;

            listElement.addEventListener('touchstart', function(e) {
                var handle = e.target.closest('.moonfin-sortable-handle');
                if (!handle) return;
                var item = handle.closest('.moonfin-sortable-item');
                if (!item) return;
                touchItem = item;
                var rect = item.getBoundingClientRect();
                touchOffsetY = e.touches[0].clientY - rect.top;
                touchClone = item.cloneNode(true);
                touchClone.className = 'moonfin-sortable-item moonfin-sortable-touch-clone';
                touchClone.style.width = rect.width + 'px';
                touchClone.style.top = rect.top + 'px';
                touchClone.style.left = rect.left + 'px';
                document.body.appendChild(touchClone);
                item.classList.add('moonfin-sortable-dragging');
            }, { passive: true });

            listElement.addEventListener('touchmove', function(e) {
                if (!touchItem || !touchClone) return;
                e.preventDefault();
                var y = e.touches[0].clientY;
                touchClone.style.top = (y - touchOffsetY) + 'px';

                var items = listElement.querySelectorAll('.moonfin-sortable-item:not(.moonfin-sortable-dragging)');
                for (var i = 0; i < items.length; i++) {
                    var rect = items[i].getBoundingClientRect();
                    var midY = rect.top + rect.height / 2;
                    if (y < midY) {
                        listElement.insertBefore(touchItem, items[i]);
                        return;
                    }
                }
                listElement.appendChild(touchItem);
            }, { passive: false });

            listElement.addEventListener('touchend', function() {
                var wasDragging = !!touchItem;
                if (touchItem) {
                    touchItem.classList.remove('moonfin-sortable-dragging');
                    touchItem = null;
                }
                if (touchClone && touchClone.parentNode) {
                    touchClone.parentNode.removeChild(touchClone);
                    touchClone = null;
                }
                if (wasDragging) {
                    collectAndSave();
                }
            }, { passive: true });
        })();
    },

    createSection: function(icon, title, contentHtml, openByDefault) {
        return '<details class="moonfin-panel-section"' + (openByDefault ? ' open' : '') + '>' +
            '<summary class="moonfin-panel-summary">' + (icon ? icon + ' ' : '') + title + '</summary>' +
            '<div class="moonfin-panel-section-content">' +
                contentHtml +
            '</div>' +
        '</details>';
    },

    createDialog: function() {
        var existing = document.querySelector('.moonfin-settings-dialog');
        if (existing) existing.remove();

        var settings = Storage.getAll();
        var self = this;

        this.dialog = document.createElement('div');
        this.dialog.className = 'moonfin-settings-dialog';

        var uiContent =
            this.createToggleCard('navbarEnabled', 'Navigation Bar', 'Show the custom navigation bar with quick access buttons', settings.navbarEnabled) +
            this.createSelectCard('navbarPosition', 'Navbar Position', 'Show the navigation bar at the top or as a left sidebar', [
                { value: 'top', label: 'Top' },
                { value: 'left', label: 'Left (Sidebar)' }
            ], settings.navbarPosition) +
            '<div class="moonfin-mediabar-toggle-wrap">' +
                this.createToggleCard('mediaBarEnabled', 'Media Bar', 'Show the featured media carousel on the home page', settings.mediaBarEnabled) +
            '</div>' +
            '<div class="moonfin-desktop-mediabar-mode-wrap" style="display:none">' +
                this.createSelectCard('desktopMediaBarProvider', 'Desktop Media Bar', 'Choose which media bar to use on desktop', [
                    { value: 'paradox', label: 'Paradox Media Bar' },
                    { value: 'enhanced', label: 'Media Bar Enhanced' },
                    { value: 'moonfin', label: 'Moonfin Media Bar' },
                    { value: 'off', label: 'Off' }
                ], settings.mediaBarEnabled ? 'moonfin' : 'off') +
            '</div>' +
            this.createToggleCard('detailsPageEnabled', 'Details Page', 'Use the custom Moonfin details page instead of the default Jellyfin one', settings.detailsPageEnabled) +
            this.createToggleCard('libraryPageEnabled', 'Library Page', 'Use the custom Moonfin library browser instead of the default Jellyfin library page', settings.libraryPageEnabled !== false);

        var mediaBarContent =
            this.createSelectCard('mediaBarSourceType', 'Content Source', 'Where to pull media bar items from', [
                { value: 'library', label: 'Library (Random)' },
                { value: 'collection', label: 'Collections / Playlists' }
            ], settings.mediaBarSourceType) +

            '<div class="moonfin-mediabar-library-options" style="' + (settings.mediaBarSourceType === 'collection' ? 'display:none' : '') + '">' +
                '<div class="moonfin-select-card">' +
                    '<div class="moonfin-select-info">' +
                        '<div class="moonfin-toggle-title">Libraries</div>' +
                        '<div class="moonfin-toggle-desc">Optionally select which libraries to use. Leave all unchecked to use all libraries.</div>' +
                    '</div>' +
                    '<div class="moonfin-library-picker" id="moonfin-library-picker">' +
                        '<div class="moonfin-collection-picker-loading">Loading...</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="moonfin-mediabar-collection-options" style="' + (settings.mediaBarSourceType === 'collection' ? '' : 'display:none') + '">' +
                '<div class="moonfin-select-card">' +
                    '<div class="moonfin-select-info">' +
                        '<div class="moonfin-toggle-title">Collections / Playlists</div>' +
                        '<div class="moonfin-toggle-desc">Select which collections or playlists to show in the media bar</div>' +
                    '</div>' +
                    '<div class="moonfin-collection-picker" id="moonfin-collection-picker">' +
                        '<div class="moonfin-collection-picker-loading">Loading...</div>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            '<div class="moonfin-select-card">' +
                '<div class="moonfin-select-info">' +
                    '<div class="moonfin-toggle-title">Excluded Genres</div>' +
                    '<div class="moonfin-toggle-desc">Items from these genres will not appear in the media bar.</div>' +
                '</div>' +
                '<div class="moonfin-genre-picker" id="moonfin-genre-picker">' +
                    '<div class="moonfin-collection-picker-loading">Loading...</div>' +
                '</div>' +
            '</div>' +

            this.createSelectCard('mediaBarItemCount', 'Number of Items', 'How many items to display', [
                { value: '5', label: '5' },
                { value: '10', label: '10' },
                { value: '15', label: '15' },
                { value: '20', label: '20' }
            ], settings.mediaBarItemCount) +

            this.createToggleCard('mediaBarTrailerPreview', 'Trailer Preview', 'Automatically play muted trailer previews in the media bar background', settings.mediaBarTrailerPreview);

        var colorOptions = [];
        var colorKeys = Object.keys(Storage.colorOptions);
        for (var i = 0; i < colorKeys.length; i++) {
            colorOptions.push({ value: colorKeys[i], label: Storage.colorOptions[colorKeys[i]].name });
        }

        var overlayContent =
            this.createSelectCard('mediaBarOverlayColor', 'Overlay Color', 'Color of the gradient overlay on media bar items', colorOptions, settings.mediaBarOverlayColor) +
            '<div class="moonfin-color-preview" id="moonfin-color-preview" style="background:' + Storage.getColorHex(settings.mediaBarOverlayColor) + '"></div>' +
            this.createRangeCard('mediaBarOpacity', 'Overlay Opacity', 'Transparency of the gradient overlay', 0, 100, 5, settings.mediaBarOpacity, '%');

        var detailsContent =
            this.createRangeCard('detailsBackdropOpacity', 'Backdrop Opacity', 'Controls how dark the details background image is', 0, 100, 1, settings.detailsBackdropOpacity, '%') +
            this.createRangeCard('detailsBackdropBlur', 'Backdrop Blur', 'Adds blur to the details background image', 0, 40, 1, settings.detailsBackdropBlur, 'px');

        var toolbarContent =
            this.createToggleCard('showShuffleButton', 'Shuffle Button', 'Show random content button in the toolbar', settings.showShuffleButton) +
            this.createSelectCard('shuffleContentType', 'Shuffle Content Type', 'What type of content to shuffle', [
                { value: 'both', label: 'Movies & TV Shows' },
                { value: 'movies', label: 'Movies Only' },
                { value: 'tv', label: 'TV Shows Only' }
            ], settings.shuffleContentType) +
            this.createToggleCard('showGenresButton', 'Genres Button', 'Show genres dropdown in the toolbar', settings.showGenresButton) +
            this.createToggleCard('showFavoritesButton', 'Favorites Button', 'Show favorites button in the toolbar', settings.showFavoritesButton) +
            this.createToggleCard('showCastButton', 'Cast Button', 'Show Chromecast button in the toolbar', settings.showCastButton) +
            this.createToggleCard('showSyncPlayButton', 'SyncPlay Button', 'Show SyncPlay button in the toolbar', settings.showSyncPlayButton) +
            this.createToggleCard('showLibrariesInToolbar', 'Library Shortcuts', 'Show library quick links in the toolbar', settings.showLibrariesInToolbar);

        var seasonalOptions = [];
        var seasonKeys = Object.keys(Storage.seasonalOptions);
        for (var j = 0; j < seasonKeys.length; j++) {
            seasonalOptions.push({ value: seasonKeys[j], label: Storage.seasonalOptions[seasonKeys[j]].name });
        }

        var displayContent =
            this.createToggleCard('showClock', 'Clock', 'Show a clock in the navigation bar', settings.showClock) +
            this.createToggleCard('use24HourClock', '24-Hour Format', 'Use 24-hour time format instead of 12-hour', settings.use24HourClock) +
            this.createSelectCard('seasonalSurprise', 'Seasonal Effect', 'Add a seasonal visual effect to the interface', seasonalOptions, settings.seasonalSurprise);

        var jellyseerrContent =
            '<div class="moonfin-jellyseerr-status-group">' +
                '<div class="moonfin-jellyseerr-sso-status">' +
                    '<span class="moonfin-jellyseerr-sso-indicator"></span>' +
                    '<span class="moonfin-jellyseerr-sso-text">Checking...</span>' +
                '</div>' +
            '</div>' +
            '<div class="moonfin-jellyseerr-login-group" style="display:none">' +
                '<div class="moonfin-jellyseerr-auth-type-group" style="margin-bottom:12px">' +
                    '<div class="moonfin-segmented-control">' +
                        '<button type="button" class="moonfin-segmented-btn moonfin-segmented-btn-active" data-auth-type="jellyfin">Jellyfin Account</button>' +
                        '<button type="button" class="moonfin-segmented-btn" data-auth-type="local">Local Account</button>' +
                    '</div>' +
                '</div>' +
                '<p class="moonfin-toggle-desc moonfin-jellyseerr-login-desc" style="margin:0 0 12px 0">Sign in to link Moonfin with your Seerr account. Moonfin uses this session for seamless in-app integration, so you do not need to log in again inside the Seerr view.</p>' +
                '<div class="moonfin-jellyseerr-login-error" style="display:none"></div>' +
                '<div style="margin-bottom:8px">' +
                    '<label class="moonfin-input-label moonfin-jellyseerr-username-label">Username</label>' +
                    '<input type="text" id="jellyseerr-settings-username" autocomplete="username" class="moonfin-panel-input">' +
                '</div>' +
                '<div style="margin-bottom:12px">' +
                    '<label class="moonfin-input-label">Password</label>' +
                    '<input type="password" id="jellyseerr-settings-password" autocomplete="current-password" class="moonfin-panel-input" placeholder="Leave empty if no password">' +
                '</div>' +
                '<button class="moonfin-jellyseerr-settings-login-btn moonfin-panel-btn moonfin-panel-btn-primary">Sign In</button>' +
            '</div>' +
            '<div class="moonfin-jellyseerr-signedIn-group" style="display:none">' +
                '<button class="moonfin-jellyseerr-settings-logout-btn moonfin-panel-btn moonfin-panel-btn-danger">Sign Out</button>' +
            '</div>';

        var mdblistSources = [
            { key: 'imdb',           label: 'IMDb' },
            { key: 'tmdb',           label: 'TMDb' },
            { key: 'trakt',          label: 'Trakt' },
            { key: 'tomatoes',       label: 'Rotten Tomatoes (Critics)' },
            { key: 'popcorn',        label: 'Rotten Tomatoes (Audience)' },
            { key: 'metacritic',     label: 'Metacritic' },
            { key: 'metacriticuser', label: 'Metacritic User' },
            { key: 'letterboxd',     label: 'Letterboxd' },
            { key: 'rogerebert',     label: 'Roger Ebert' },
            { key: 'myanimelist',    label: 'MyAnimeList' },
            { key: 'anilist',        label: 'AniList' }
        ];
        var selectedSources = settings.mdblistRatingSources || ['imdb', 'tmdb', 'tomatoes', 'metacritic'];
        var serverUrl = (window.ApiClient && window.ApiClient.serverAddress ? window.ApiClient.serverAddress() : '') || '';
        var sourceIconFiles = {
            imdb: 'imdb.svg', tmdb: 'tmdb.svg', trakt: 'trakt.svg',
            tomatoes: 'rt-fresh.svg', popcorn: 'rt-audience-up.svg',
            metacritic: 'metacritic.svg', metacriticuser: 'metacritic-user.svg',
            letterboxd: 'letterboxd.svg', rogerebert: 'rogerebert.svg',
            myanimelist: 'mal.svg', anilist: 'anilist.svg'
        };

        // Build ordered list: enabled sources first (in saved order), then disabled
        var orderedSources = [];
        for (var oi = 0; oi < selectedSources.length; oi++) {
            for (var oj = 0; oj < mdblistSources.length; oj++) {
                if (mdblistSources[oj].key === selectedSources[oi]) {
                    orderedSources.push({ key: mdblistSources[oj].key, label: mdblistSources[oj].label, enabled: true });
                    break;
                }
            }
        }
        for (var uk = 0; uk < mdblistSources.length; uk++) {
            if (selectedSources.indexOf(mdblistSources[uk].key) === -1) {
                orderedSources.push({ key: mdblistSources[uk].key, label: mdblistSources[uk].label, enabled: false });
            }
        }

        var sourceItems = '';
        for (var si = 0; si < orderedSources.length; si++) {
            var src = orderedSources[si];
            var iconUrl = serverUrl + '/Moonfin/Assets/' + (sourceIconFiles[src.key] || 'imdb.svg');
            sourceItems += '<div class="moonfin-sortable-item' + (src.enabled ? ' moonfin-sortable-item-active' : '') + '" draggable="true" data-source="' + src.key + '">' +
                '<span class="moonfin-sortable-handle">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/></svg>' +
                '</span>' +
                '<img class="moonfin-sortable-icon" src="' + iconUrl + '" alt="' + src.label + '">' +
                '<span class="moonfin-sortable-label">' + src.label + '</span>' +
                '<button type="button" class="moonfin-sortable-toggle" title="' + (src.enabled ? 'Disable' : 'Enable') + '">' +
                    '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="' + (src.enabled ? 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z' : 'M19 13H5v-2h14v2z') + '"/></svg>' +
                '</button>' +
            '</div>';
        }

        var tmdbContent =
            this.createToggleCard('tmdbEpisodeRatingsEnabled', 'Enable Episode Ratings', 'Show TMDB ratings for individual TV episodes on the details page', settings.tmdbEpisodeRatingsEnabled) +
            '<div class="moonfin-tmdb-config" style="' + (settings.tmdbEpisodeRatingsEnabled ? '' : 'display:none') + '">' +
                (Storage.syncState.tmdbAvailable ?
                    '<div style="background-color: rgba(0, 180, 0, 0.1); border-left: 4px solid #00b400; border-radius: 4px; padding: 0.8em 1em; margin-bottom: 12px; font-size: 13px; color: rgba(255,255,255,0.8);">' +
                        'Your server admin has provided a server-wide TMDB API key. You can leave the field below blank to use it, or enter your own key.' +
                    '</div>' : '') +
                '<div style="margin-bottom:12px">' +
                    '<label class="moonfin-input-label">TMDB API Key</label>' +
                    '<input type="password" id="moonfin-tmdbApiKey" class="moonfin-panel-input" placeholder="' + (Storage.syncState.tmdbAvailable ? 'Using server key (optional override)' : 'Enter your TMDB API key or v4 token') + '" value="' + (settings.tmdbApiKey || '') + '">' +
                    '<div class="moonfin-toggle-desc" style="margin-top:4px">Get a free API key at <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noopener" style="color:#00a4dc">themoviedb.org/settings/api</a></div>' +
                '</div>' +
            '</div>';

        var mdblistContent =
            this.createToggleCard('mdblistEnabled', 'Enable MDBList Ratings', 'Show ratings from MDBList (IMDb, Rotten Tomatoes, Metacritic, etc.) on media bar and item details', settings.mdblistEnabled) +
            '<div class="moonfin-mdblist-config" style="' + (settings.mdblistEnabled ? '' : 'display:none') + '">' +
                this.createToggleCard('mdblistShowRatingNames', 'Show Rating Source Names', 'Display the name of each rating source below its score', settings.mdblistShowRatingNames) +
                (Storage.syncState.mdblistAvailable ?
                    '<div style="background-color: rgba(0, 180, 0, 0.1); border-left: 4px solid #00b400; border-radius: 4px; padding: 0.8em 1em; margin-bottom: 12px; font-size: 13px; color: rgba(255,255,255,0.8);">' +
                        'Your server admin has provided a server-wide MDBList API key. You can leave the field below blank to use it, or enter your own key.' +
                    '</div>' : '') +
                '<div style="margin-bottom:12px">' +
                    '<label class="moonfin-input-label">MDBList API Key</label>' +
                    '<input type="password" id="moonfin-mdblistApiKey" class="moonfin-panel-input" placeholder="' + (Storage.syncState.mdblistAvailable ? 'Using server key (optional override)' : 'Enter your mdblist.com API key') + '" value="' + (settings.mdblistApiKey || '') + '">' +
                    '<div class="moonfin-toggle-desc" style="margin-top:4px">Get your free API key at <a href="https://mdblist.com/preferences/" target="_blank" rel="noopener" style="color:#00a4dc">mdblist.com/preferences</a></div>' +
                '</div>' +
                '<div style="margin-bottom:8px">' +
                    '<label class="moonfin-input-label">Rating Sources</label>' +
                    '<p class="moonfin-toggle-desc" style="margin:0 0 8px 0">Drag to reorder. Click the icon on the right to enable or disable a source.</p>' +
                    '<div class="moonfin-sortable-list" id="moonfin-sources-sortable">' + sourceItems + '</div>' +
                '</div>' +
            '</div>';

        var homeSections = [
            { key: 'smalllibrarytiles', label: 'My Media' },
            { key: 'librarybuttons',    label: 'My Media (Small)' },
            { key: 'resume',            label: 'Continue Watching' },
            { key: 'resumeaudio',       label: 'Continue Listening' },
            { key: 'resumebook',        label: 'Continue Reading' },
            { key: 'nextup',            label: 'Next Up' },
            { key: 'latestmedia',       label: 'Latest Media' },
            { key: 'livetv',            label: 'Live TV' },
            { key: 'activerecordings',  label: 'Active Recordings' }
        ];
        var selectedRows = (settings.homeRowOrder && settings.homeRowOrder.length) ? settings.homeRowOrder : Storage.defaults.homeRowOrder;

        var orderedRows = [];
        for (var ri = 0; ri < selectedRows.length; ri++) {
            for (var rj = 0; rj < homeSections.length; rj++) {
                if (homeSections[rj].key === selectedRows[ri]) {
                    orderedRows.push({ key: homeSections[rj].key, label: homeSections[rj].label, enabled: true });
                    break;
                }
            }
        }
        for (var rk = 0; rk < homeSections.length; rk++) {
            if (selectedRows.indexOf(homeSections[rk].key) === -1) {
                orderedRows.push({ key: homeSections[rk].key, label: homeSections[rk].label, enabled: false });
            }
        }

        var rowItems = '';
        for (var rsi = 0; rsi < orderedRows.length; rsi++) {
            var row = orderedRows[rsi];
            rowItems += '<div class="moonfin-sortable-item' + (row.enabled ? ' moonfin-sortable-item-active' : '') + '" draggable="true" data-source="' + row.key + '">' +
                '<span class="moonfin-sortable-handle">' +
                    '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/></svg>' +
                '</span>' +
                '<span class="moonfin-sortable-label">' + row.label + '</span>' +
                '<label class="moonfin-sortable-checkbox"><input type="checkbox"' + (row.enabled ? ' checked' : '') + '></label>' +
            '</div>';
        }

        var homeRowContent =
            '<p class="moonfin-toggle-desc" style="margin:0 0 8px 0">Drag to reorder. Check or uncheck to show or hide a section. Changes are saved to the Jellyfin server per device profile.</p>' +
            '<p class="moonfin-toggle-desc" id="moonfin-homerows-source" style="margin:0 0 8px 0">Resolved source for global: ' + this.getHomeRowsSourceLabel((settings.homeRowsSource || (settings.homeRowsV2 && settings.homeRowsV2.length ? 'moonfin' : 'legacy'))) + '</p>' +
            '<div id="moonfin-homerows-v2-preview" style="margin:0 0 10px 0; padding:8px 10px; border:1px solid rgba(255,255,255,0.12); border-radius:8px; background:rgba(0,0,0,0.15)">' + this.renderHomeRowsV2Preview(settings) + '</div>' +
            '<div class="moonfin-sortable-list" id="moonfin-homerows-sortable">' + rowItems + '</div>';

        var currentDeviceProfile = Device.getProfileName();
        var profileLabels = { global: 'All Devices', desktop: 'Desktop', mobile: 'Mobile', tv: 'TV' };
        var profileTabsHtml = '<div class="moonfin-profile-tabs">';
        var profileNames = ['global', 'desktop', 'mobile', 'tv'];
        for (var pi = 0; pi < profileNames.length; pi++) {
            var pn = profileNames[pi];
            var isActive = pn === 'global';
            var isCurrent = pn === currentDeviceProfile;
            profileTabsHtml += '<button type="button" class="moonfin-profile-tab' + (isActive ? ' moonfin-profile-tab-active' : '') + '" data-profile="' + pn + '">' +
                profileLabels[pn] +
                (isCurrent ? ' <span class="moonfin-profile-current-badge" title="Current device">●</span>' : '') +
            '</button>';
        }
        profileTabsHtml += '</div>';
        var profileInfoHtml = '<div class="moonfin-profile-info">' +
            '<span class="moonfin-profile-info-icon">ℹ</span> ' +
            '<span class="moonfin-profile-info-text">"All Devices" settings apply everywhere. Device profiles override only the settings you change.</span>' +
        '</div>';

        this.dialog.innerHTML =
            '<div class="moonfin-settings-overlay"></div>' +
            '<div class="moonfin-settings-panel">' +
                '<div class="moonfin-settings-header">' +
                    '<div class="moonfin-settings-header-left">' +
                        '<h2>Moonfin</h2>' +
                        '<span class="moonfin-settings-subtitle">Settings</span>' +
                    '</div>' +
                    '<button class="moonfin-settings-close" title="Close">' +
                        '<svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>' +
                    '</button>' +
                '</div>' +
                profileTabsHtml +
                profileInfoHtml +
                '<div class="moonfin-settings-content">' +
                    this.createSection('', 'Moonfin UI', uiContent, true) +
                    this.createSection('', 'Media Bar', mediaBarContent).replace('<details class="moonfin-panel-section"', '<details class="moonfin-panel-section" data-section="mediabar"') +
                    this.createSection('', 'Overlay Appearance', overlayContent) +
                    this.createSection('', 'Details Appearance', detailsContent) +
                    this.createSection('', 'Toolbar Buttons', toolbarContent) +
                    this.createSection('', 'Display', displayContent) +
                    this.createSection('', 'TMDB Episode Ratings', tmdbContent) +
                    this.createSection('', 'MDBList Ratings', mdblistContent) +
                    this.createSection('', 'Home Screen Rows', homeRowContent) +
                    '<div class="moonfin-settings-jellyseerr-wrapper" style="display:none">' +
                        this.createSection('', 'Seerr', jellyseerrContent) +
                    '</div>' +
                '</div>' +
                '<div class="moonfin-settings-footer">' +
                    '<div class="moonfin-sync-status" id="moonfinSyncStatus">' +
                        '<span class="moonfin-sync-indicator"></span>' +
                        '<span class="moonfin-sync-text">Checking sync...</span>' +
                        '<label class="moonfin-sync-toggle-label" title="Enable or disable settings sync to server">' +
                            '<input type="checkbox" id="moonfin-sync-toggle"' + (Storage.isSyncEnabled() ? ' checked' : '') + '>' +
                            '<span class="moonfin-sync-toggle-text">Sync</span>' +
                        '</label>' +
                    '</div>' +
                    '<div class="moonfin-settings-footer-buttons">' +
                        '<button class="moonfin-panel-btn moonfin-panel-btn-ghost moonfin-settings-reset">Reset</button>' +
                        '<button class="moonfin-panel-btn moonfin-panel-btn-ghost moonfin-settings-sync">Sync</button>' +
                        '<button class="moonfin-panel-btn moonfin-panel-btn-close moonfin-settings-close-btn">Close</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(this.dialog);
        Storage.setActiveEditProfile('global');
        this.setupEventListeners();
        this.updateSyncStatus();
        this.updateJellyseerrSsoSection();
    },

    refreshFormValues: function(profileName) {
        if (!this.dialog) return;
        var resolved = Storage.resolveSettings(profileName);
        var raw = (profileName !== 'global') ? Storage.getProfile(profileName) : null;
        var desktopMode = this.getDesktopMediaBarMode(profileName, resolved, raw);

        // Update checkboxes
        var checkboxes = this.dialog.querySelectorAll('input[type="checkbox"][name]');
        for (var i = 0; i < checkboxes.length; i++) {
            var name = checkboxes[i].name;
            if (name in resolved) {
                checkboxes[i].checked = resolved[name];
                // Visual indicator: dim if inherited from global/defaults on a device profile
                var isInherited = raw !== null && (raw[name] === undefined || raw[name] === null);
                var card = checkboxes[i].closest('.moonfin-toggle-card');
                if (card) {
                    card.classList.toggle('moonfin-inherited', isInherited);
                }
            }
        }

        // Update selects
        var selects = this.dialog.querySelectorAll('select[name]');
        for (var j = 0; j < selects.length; j++) {
            var sName = selects[j].name;
            if (sName in resolved) {
                selects[j].value = String(resolved[sName]);
                var sCard = selects[j].closest('.moonfin-select-card');
                if (sCard && raw !== null) {
                    sCard.classList.toggle('moonfin-inherited', raw[sName] === undefined || raw[sName] === null);
                }
            }
        }

        // Update ranges
        var ranges = this.dialog.querySelectorAll('input[type="range"][name]');
        for (var k = 0; k < ranges.length; k++) {
            var rName = ranges[k].name;
            if (rName in resolved) {
                ranges[k].value = resolved[rName];
                var valueSpan = this.dialog.querySelector('.moonfin-range-value[data-for="' + rName + '"]');
                if (valueSpan) {
                    var suffix = valueSpan.getAttribute('data-suffix') || '';
                    valueSpan.textContent = resolved[rName] + suffix;
                }
            }
        }

        // Update text/password inputs
        var textInputs = [
            { id: 'moonfin-mdblistApiKey', key: 'mdblistApiKey' },
            { id: 'moonfin-tmdbApiKey', key: 'tmdbApiKey' }
        ];
        for (var ti = 0; ti < textInputs.length; ti++) {
            var inp = this.dialog.querySelector('#' + textInputs[ti].id);
            if (inp) inp.value = resolved[textInputs[ti].key] || '';
        }

        // Update color preview
        var colorPreview = this.dialog.querySelector('#moonfin-color-preview');
        if (colorPreview) {
            colorPreview.style.background = Storage.getColorHex(resolved.mediaBarOverlayColor);
        }

        // Toggle config sub-sections
        var mdblistConfig = this.dialog.querySelector('.moonfin-mdblist-config');
        if (mdblistConfig) mdblistConfig.style.display = resolved.mdblistEnabled ? '' : 'none';
        var tmdbConfig = this.dialog.querySelector('.moonfin-tmdb-config');
        if (tmdbConfig) tmdbConfig.style.display = resolved.tmdbEpisodeRatingsEnabled ? '' : 'none';

        // Toggle media bar source sub-sections
        var isCollection = resolved.mediaBarSourceType === 'collection';
        var libraryOpts = this.dialog.querySelector('.moonfin-mediabar-library-options');
        var collectionOpts = this.dialog.querySelector('.moonfin-mediabar-collection-options');
        if (libraryOpts) libraryOpts.style.display = isCollection ? 'none' : '';
        if (collectionOpts) collectionOpts.style.display = isCollection ? '' : 'none';
        if (isCollection) this.loadCollectionPicker();
        if (!isCollection) this.loadLibraryPicker();
        this.loadGenrePicker();

        var mediaBarToggleWrap = this.dialog.querySelector('.moonfin-mediabar-toggle-wrap');
        var desktopModeWrap = this.dialog.querySelector('.moonfin-desktop-mediabar-mode-wrap');
        if (mediaBarToggleWrap && desktopModeWrap) {
            var showDesktopMode = desktopMode !== null;
            mediaBarToggleWrap.style.display = showDesktopMode ? 'none' : '';
            desktopModeWrap.style.display = showDesktopMode ? '' : 'none';

            var desktopModeSelect = this.dialog.querySelector('select[name="desktopMediaBarProvider"]');
            if (desktopModeSelect && showDesktopMode) {
                desktopModeSelect.value = desktopMode;
            }
        }

        this.toggleMediaBarSettingsVisibility(profileName, desktopMode);
        this.updateHomeRowsStatus(profileName, resolved);

        // Update profile info text
        var infoText = this.dialog.querySelector('.moonfin-profile-info-text');
        if (infoText) {
            if (profileName === 'global') {
                infoText.textContent = '"All Devices" settings apply everywhere. Device profiles override only the settings you change.';
            } else {
                var label = profileName.charAt(0).toUpperCase() + profileName.slice(1);
                infoText.textContent = 'Editing ' + label + ' overrides. Dimmed settings are inherited from "All Devices". Changes here only affect ' + label + ' devices.';
            }
        }
    },

    updateJellyseerrSsoSection: function() {
        var self = this;
        var wrapper = this.dialog ? this.dialog.querySelector('.moonfin-settings-jellyseerr-wrapper') : null;
        if (!wrapper) return Promise.resolve();

        // Always fetch fresh config to catch admin changes
        return Jellyseerr.fetchConfig().then(function() {
            if (!Jellyseerr.config || !Jellyseerr.config.enabled || !Jellyseerr.config.url) {
                wrapper.style.display = 'none';
                return;
            }

            wrapper.style.display = '';

            var indicator = wrapper.querySelector('.moonfin-jellyseerr-sso-indicator');
            var text = wrapper.querySelector('.moonfin-jellyseerr-sso-text');
            var loginGroup = wrapper.querySelector('.moonfin-jellyseerr-login-group');
            var signedInGroup = wrapper.querySelector('.moonfin-jellyseerr-signedIn-group');

            return Jellyseerr.checkSsoStatus().then(function() {
                if (Jellyseerr.ssoStatus && Jellyseerr.ssoStatus.authenticated) {
                    indicator.className = 'moonfin-jellyseerr-sso-indicator connected';
                    var displayName = Jellyseerr.ssoStatus.displayName || 'Unknown';
                    text.textContent = 'Signed in as ' + displayName;
                    loginGroup.style.display = 'none';
                    signedInGroup.style.display = '';
                } else {
                    indicator.className = 'moonfin-jellyseerr-sso-indicator disconnected';
                    text.textContent = 'Not signed in';
                    loginGroup.style.display = '';
                    signedInGroup.style.display = 'none';

                    var api = API.getApiClient();
                    if (api && api._currentUser) {
                        var usernameInput = wrapper.querySelector('#jellyseerr-settings-username');
                        if (usernameInput && !usernameInput.value) {
                            usernameInput.value = api._currentUser.Name || '';
                        }
                    }
                }
            });
        });
    },

    updateSyncStatus: function() {
        var self = this;
        var statusEl = this.dialog ? this.dialog.querySelector('#moonfinSyncStatus') : null;
        if (!statusEl) return Promise.resolve();

        var indicator = statusEl.querySelector('.moonfin-sync-indicator');
        var text = statusEl.querySelector('.moonfin-sync-text');

        var syncStatus = Storage.getSyncStatus();

        if (syncStatus.syncing) {
            indicator.className = 'moonfin-sync-indicator syncing';
            text.textContent = 'Syncing...';
            return Promise.resolve();
        }

        // Always re-ping when the panel opens to get fresh status
        indicator.className = 'moonfin-sync-indicator checking';
        text.textContent = 'Checking server...';
        return Storage.pingServer().then(function() {
            var freshStatus = Storage.getSyncStatus();
            if (freshStatus.available) {
                indicator.className = 'moonfin-sync-indicator connected';
                if (freshStatus.lastSync) {
                    var ago = Math.round((Date.now() - freshStatus.lastSync) / 1000);
                    text.textContent = 'Synced ' + (ago < 60 ? ago + 's' : Math.round(ago / 60) + 'm') + ' ago';
                } else {
                    text.textContent = 'Server sync available';
                }
            } else {
                indicator.className = 'moonfin-sync-indicator disconnected';
                text.textContent = freshStatus.error || 'Server sync unavailable';
            }
        });
    },

    setupEventListeners: function() {
        var self = this;

        this.dialog.querySelector('.moonfin-settings-close').addEventListener('click', function() {
            self.hide();
        });

        this.dialog.querySelector('.moonfin-settings-close-btn').addEventListener('click', function() {
            self.hide();
        });

        this.dialog.querySelector('.moonfin-settings-overlay').addEventListener('click', function() {
            self.hide();
        });

        this.dialog.querySelector('.moonfin-settings-reset').addEventListener('click', function() {
            var activeProfile = Storage.getActiveEditProfile();
            if (activeProfile !== 'global') {
                if (confirm('Reset "' + activeProfile + '" device profile? This will remove all overrides for this device.')) {
                    Storage.deleteProfile(activeProfile);
                    self.showToast('Device profile reset');
                    self.hide();
                    setTimeout(function() { self.show(); }, 350);
                }
            } else {
                if (confirm('Reset all Moonfin settings to defaults?')) {
                    Storage.reset();
                    self.showToast('Settings reset to defaults');
                    self.hide();
                    setTimeout(function() { self.show(); }, 350);
                }
            }
        });

        this.dialog.querySelector('.moonfin-settings-sync').addEventListener('click', function() {
            var syncBtn = self.dialog.querySelector('.moonfin-settings-sync');
            self.showSyncModeDialog().then(function(syncChoice) {
                if (!syncChoice) {
                    self.showToast('Sync canceled');
                    return;
                }

                syncBtn.disabled = true;
                syncBtn.textContent = 'Syncing...';

                var op;
                if (syncChoice === 'push') {
                    var localProfiles = Storage.getProfiles();
                    op = Storage.pingServer().then(function(ping) {
                        if (!Storage.isSyncEnabled() || !ping || !ping.installed || !ping.settingsSyncEnabled) {
                            return false;
                        }
                        return Storage.saveAllProfilesToServer(localProfiles);
                    }).then(function(ok) {
                        if (ok) Storage.saveSnapshot(localProfiles);
                        return ok;
                    });
                } else {
                    op = Storage.pingServer().then(function(ping) {
                        if (!Storage.isSyncEnabled() || !ping || !ping.installed || !ping.settingsSyncEnabled) {
                            return false;
                        }
                        return Storage.sync(true).then(function() { return true; });
                    });
                }

                return op.then(function(ok) {
                    return self.updateSyncStatus().then(function() { return ok; });
                }).then(function(ok) {
                    syncBtn.disabled = false;
                    syncBtn.textContent = 'Sync';

                    if (!ok) {
                        self.showToast('Sync failed');
                        return;
                    }

                    self.showToast(syncChoice === 'pull' ? 'Pulled settings from profile' : 'Pushed settings to profile');
                    self.hide();
                    setTimeout(function() { self.show(); }, 350);
                }).catch(function() {
                    syncBtn.disabled = false;
                    syncBtn.textContent = 'Sync';
                    self.showToast('Sync failed');
                });
            });
        });

        // Profile tab switching
        var profileTabs = this.dialog.querySelectorAll('.moonfin-profile-tab');
        for (var pti = 0; pti < profileTabs.length; pti++) {
            profileTabs[pti].addEventListener('click', function() {
                var profileName = this.getAttribute('data-profile');
                for (var pt = 0; pt < profileTabs.length; pt++) {
                    profileTabs[pt].classList.remove('moonfin-profile-tab-active');
                }
                this.classList.add('moonfin-profile-tab-active');
                Storage.setActiveEditProfile(profileName);
                self.refreshFormValues(profileName);
                self.showToast('Editing: ' + (profileName === 'global' ? 'All Devices' : profileName.charAt(0).toUpperCase() + profileName.slice(1)));
            });
        }

        // Sync toggle
        var syncToggle = this.dialog.querySelector('#moonfin-sync-toggle');
        if (syncToggle) {
            syncToggle.addEventListener('change', function() {
                Storage.setSyncEnabled(syncToggle.checked);
                self.showToast(syncToggle.checked ? 'Sync enabled' : 'Sync disabled');
                self.updateSyncStatus();
            });
        }

        var checkboxes = this.dialog.querySelectorAll('input[type="checkbox"][name]');
        for (var i = 0; i < checkboxes.length; i++) {
            (function(cb) {
                cb.addEventListener('change', function() {
                    self.saveSetting(cb.name, cb.checked);
                    self.showToast(cb.checked ? 'Enabled' : 'Disabled');

                    if (cb.name === 'mdblistEnabled') {
                        var configDiv = self.dialog.querySelector('.moonfin-mdblist-config');
                        if (configDiv) {
                            configDiv.style.display = cb.checked ? '' : 'none';
                        }
                    }

                    if (cb.name === 'tmdbEpisodeRatingsEnabled') {
                        var tmdbConfigDiv = self.dialog.querySelector('.moonfin-tmdb-config');
                        if (tmdbConfigDiv) {
                            tmdbConfigDiv.style.display = cb.checked ? '' : 'none';
                        }
                    }
                });
            })(checkboxes[i]);
        }

        var selects = this.dialog.querySelectorAll('select');
        for (var j = 0; j < selects.length; j++) {
            (function(sel) {
                sel.addEventListener('change', function() {
                    if (sel.name === 'desktopMediaBarProvider') {
                        var mode = String(sel.value || '').toLowerCase();
                        if (mode !== 'paradox' && mode !== 'moonfin' && mode !== 'off') mode = 'off';
                        self.saveSetting('desktopMediaBarProvider', mode);
                        self.saveSetting('mediaBarEnabled', mode === 'moonfin');
                        self.toggleMediaBarSettingsVisibility(Storage.getActiveEditProfile(), mode);
                        self.showToast('Desktop media bar updated');
                        return;
                    }
                    var val = sel.value;
                    var numVal = parseInt(val, 10);
                    self.saveSetting(sel.name, isNaN(numVal) ? val : numVal);
                    self.showToast('Setting updated');
                });
            })(selects[j]);
        }

        var ranges = this.dialog.querySelectorAll('input[type="range"]');
        for (var k = 0; k < ranges.length; k++) {
            (function(range) {
                range.addEventListener('input', function() {
                    var valueSpan = self.dialog.querySelector('.moonfin-range-value[data-for="' + range.name + '"]');
                    if (valueSpan) {
                        var suffix = valueSpan.getAttribute('data-suffix') || '';
                        valueSpan.textContent = range.value + suffix;
                    }
                });
                range.addEventListener('change', function() {
                    self.saveSetting(range.name, parseInt(range.value, 10));
                    self.showToast('Setting updated');
                });
            })(ranges[k]);
        }

        var colorSelect = this.dialog.querySelector('select[name="mediaBarOverlayColor"]');
        if (colorSelect) {
            colorSelect.addEventListener('change', function() {
                var preview = self.dialog.querySelector('#moonfin-color-preview');
                if (preview) {
                    preview.style.background = Storage.getColorHex(colorSelect.value);
                }
            });
        }

        this.dialog.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                self.hide();
            }
        });

        // Media bar source type toggle
        var sourceTypeSelect = this.dialog.querySelector('select[name="mediaBarSourceType"]');
        if (sourceTypeSelect) {
            sourceTypeSelect.addEventListener('change', function() {
                var isCollection = sourceTypeSelect.value === 'collection';
                var libraryOpts = self.dialog.querySelector('.moonfin-mediabar-library-options');
                var collectionOpts = self.dialog.querySelector('.moonfin-mediabar-collection-options');
                if (libraryOpts) libraryOpts.style.display = isCollection ? 'none' : '';
                if (collectionOpts) collectionOpts.style.display = isCollection ? '' : 'none';
                if (isCollection) {
                    self.loadCollectionPicker();
                } else {
                    self.loadLibraryPicker();
                }
            });

            // Load pickers on init based on active source mode
            if (sourceTypeSelect.value === 'collection') {
                self.loadCollectionPicker();
            } else {
                self.loadLibraryPicker();
            }
            self.loadGenrePicker();
        }

        // MDBList API key - save on input with debounce + on blur
        var mdblistApiKeyInput = this.dialog.querySelector('#moonfin-mdblistApiKey');
        if (mdblistApiKeyInput) {
            var mdblistKeyTimer = null;
            mdblistApiKeyInput.addEventListener('input', function() {
                if (mdblistKeyTimer) clearTimeout(mdblistKeyTimer);
                mdblistKeyTimer = setTimeout(function() {
                    self.saveSetting('mdblistApiKey', mdblistApiKeyInput.value.trim());
                    self.showToast('API key saved');
                }, 800);
            });
            mdblistApiKeyInput.addEventListener('blur', function() {
                if (mdblistKeyTimer) clearTimeout(mdblistKeyTimer);
                self.saveSetting('mdblistApiKey', mdblistApiKeyInput.value.trim());
            });
        }

        // TMDB API key - save on input with debounce + on blur
        var tmdbApiKeyInput = this.dialog.querySelector('#moonfin-tmdbApiKey');
        if (tmdbApiKeyInput) {
            var tmdbKeyTimer = null;
            tmdbApiKeyInput.addEventListener('input', function() {
                if (tmdbKeyTimer) clearTimeout(tmdbKeyTimer);
                tmdbKeyTimer = setTimeout(function() {
                    self.saveSetting('tmdbApiKey', tmdbApiKeyInput.value.trim());
                    self.showToast('TMDB API key saved');
                }, 800);
            });
            tmdbApiKeyInput.addEventListener('blur', function() {
                if (tmdbKeyTimer) clearTimeout(tmdbKeyTimer);
                self.saveSetting('tmdbApiKey', tmdbApiKeyInput.value.trim());
            });
        }

        var sortableList = this.dialog.querySelector('#moonfin-sources-sortable');
        if (sortableList) {
            this._initSortableList(sortableList, function(enabled) {
                self.saveSetting('mdblistRatingSources', enabled);
                self.showToast('Rating sources updated');
            });
        }

        var homeRowList = this.dialog.querySelector('#moonfin-homerows-sortable');
        if (homeRowList) {
            this._initSortableList(homeRowList, function(enabled) {
                self.saveSetting('homeRowOrder', enabled);
                Plugin.applyHomeRowOrder();
                self.showToast('Home screen rows updated');
            });
        }

        var loginBtn = this.dialog.querySelector('.moonfin-jellyseerr-settings-login-btn');
        if (loginBtn) {
            loginBtn.addEventListener('click', function() {
                self.handleJellyseerrLogin();
            });
        }

        var passwordInput = this.dialog.querySelector('#jellyseerr-settings-password');
        if (passwordInput) {
            passwordInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    self.handleJellyseerrLogin();
                }
            });
        }

        var authTypeBtns = this.dialog.querySelectorAll('.moonfin-segmented-btn[data-auth-type]');
        for (var ati = 0; ati < authTypeBtns.length; ati++) {
            authTypeBtns[ati].addEventListener('click', function() {
                var wrapper = self.dialog.querySelector('.moonfin-settings-jellyseerr-wrapper');
                if (!wrapper) return;
                var btns = wrapper.querySelectorAll('.moonfin-segmented-btn[data-auth-type]');
                for (var j = 0; j < btns.length; j++) btns[j].classList.remove('moonfin-segmented-btn-active');
                this.classList.add('moonfin-segmented-btn-active');
                var isLocal = this.getAttribute('data-auth-type') === 'local';
                var desc = wrapper.querySelector('.moonfin-jellyseerr-login-desc');
                var usernameLabel = wrapper.querySelector('.moonfin-jellyseerr-username-label');
                if (desc) desc.textContent = isLocal
                    ? 'Enter your local Seerr account credentials. Your session is stored on the server so all devices stay signed in.'
                    : 'Enter your Jellyfin credentials to sign in to Seerr. Your session is stored on the server so all devices stay signed in.';
                if (usernameLabel) usernameLabel.textContent = isLocal ? 'Email' : 'Username';
                var passwordField = wrapper.querySelector('#jellyseerr-settings-password');
                if (passwordField) passwordField.placeholder = isLocal ? '' : 'Leave empty if no password';
            });
        }

        var logoutBtn = this.dialog.querySelector('.moonfin-jellyseerr-settings-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function() {
                if (confirm('Sign out of Seerr? You will need to sign in again to use it.')) {
                    Jellyseerr.ssoLogout().then(function() {
                        self.updateJellyseerrSsoSection();
                        self.showToast('Signed out of Seerr');
                    });
                }
            });
        }
    },

    handleJellyseerrLogin: function() {
        var self = this;
        var wrapper = this.dialog ? this.dialog.querySelector('.moonfin-settings-jellyseerr-wrapper') : null;
        if (!wrapper) return;

        var username = wrapper.querySelector('#jellyseerr-settings-username');
        var password = wrapper.querySelector('#jellyseerr-settings-password');
        var errorEl = wrapper.querySelector('.moonfin-jellyseerr-login-error');
        var submitBtn = wrapper.querySelector('.moonfin-jellyseerr-settings-login-btn');

        var usernameVal = username ? username.value : '';
        var passwordVal = password ? password.value : '';

        var activeAuthBtn = wrapper.querySelector('.moonfin-segmented-btn-active[data-auth-type]');
        var authType = activeAuthBtn ? activeAuthBtn.getAttribute('data-auth-type') : 'jellyfin';
        var isLocalAuth = authType === 'local';
        if (!usernameVal) {
            errorEl.textContent = isLocalAuth ? 'Please enter your email.' : 'Please enter your username.';
            errorEl.style.display = 'block';
            return;
        }
        if (isLocalAuth && !passwordVal) {
            errorEl.textContent = 'Please enter your password.';
            errorEl.style.display = 'block';
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
        errorEl.style.display = 'none';

        Jellyseerr.ssoLogin(usernameVal, passwordVal, authType).then(function(result) {
            if (result.success) {
                self.updateJellyseerrSsoSection();
                self.showToast('Signed in to Seerr');
            } else {
                errorEl.textContent = result.error || 'Authentication failed';
                errorEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Sign In';
            }
        });
    },

    loadCollectionPicker: function() {
        var self = this;
        var picker = this.dialog ? this.dialog.querySelector('#moonfin-collection-picker') : null;
        if (!picker) return;

        picker.innerHTML = '<div class="moonfin-collection-picker-loading">Loading...</div>';

        API.getCollectionsAndPlaylists().then(function(items) {
            if (!self.dialog) return;
            if (!items || items.length === 0) {
                picker.innerHTML = '<div class="moonfin-toggle-desc">No collections or playlists found on this server.</div>';
                return;
            }

            var settings = Storage.getAll();
            var selectedIds = settings.mediaBarCollectionIds || [];
            var serverUrl = (window.ApiClient && window.ApiClient.serverAddress ? window.ApiClient.serverAddress() : '') || '';
            var html = '';

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var isChecked = selectedIds.indexOf(item.Id) !== -1;
                var typeBadge = item.Type === 'BoxSet' ? 'Collection' : 'Playlist';
                var posterUrl = '';
                if (item.ImageTags && item.ImageTags.Primary) {
                    posterUrl = serverUrl + '/Items/' + item.Id + '/Images/Primary?maxWidth=60&quality=80&tag=' + item.ImageTags.Primary;
                }

                html +=
                    '<label class="moonfin-collection-item' + (isChecked ? ' moonfin-collection-item-active' : '') + '">' +
                        '<input type="checkbox" data-collection-id="' + item.Id + '"' + (isChecked ? ' checked' : '') + '>' +
                        (posterUrl ?
                            '<img class="moonfin-collection-poster" src="' + posterUrl + '" alt="">' :
                            '<div class="moonfin-collection-poster moonfin-collection-poster-empty"></div>') +
                        '<div class="moonfin-collection-info">' +
                            '<div class="moonfin-collection-name">' + Settings._esc(item.Name || 'Untitled') + '</div>' +
                            '<div class="moonfin-collection-type">' + typeBadge + '</div>' +
                        '</div>' +
                    '</label>';
            }

            picker.innerHTML = html;

            // Event delegation for checkboxes (guard against duplicate listeners on re-render)
            if (!picker._collectionListenerAdded) {
            picker._collectionListenerAdded = true;
            picker.addEventListener('change', function(e) {
                var cb = e.target;
                if (!cb.dataset.collectionId) return;

                var currentIds = Storage.get('mediaBarCollectionIds') || [];
                currentIds = currentIds.slice();
                var id = cb.dataset.collectionId;
                var idx = currentIds.indexOf(id);

                if (cb.checked && idx === -1) {
                    currentIds.push(id);
                } else if (!cb.checked && idx !== -1) {
                    currentIds.splice(idx, 1);
                }

                self.saveSetting('mediaBarCollectionIds', currentIds);

                var label = cb.closest('.moonfin-collection-item');
                if (label) label.classList.toggle('moonfin-collection-item-active', cb.checked);

                self.showToast(cb.checked ? 'Added to media bar' : 'Removed from media bar');
            });
            }
        }).catch(function(e) {
            console.error('[Moonfin] Failed to load collection picker:', e);
            picker.innerHTML = '<div class="moonfin-toggle-desc">Failed to load collections.</div>';
        });
    },

    loadLibraryPicker: function() {
        var self = this;
        var picker = this.dialog ? this.dialog.querySelector('#moonfin-library-picker') : null;
        if (!picker) return;

        picker.innerHTML = '<div class="moonfin-collection-picker-loading">Loading...</div>';

        API.getUserViews().then(function(views) {
            if (!self.dialog) return;

            var libraries = [];
            for (var i = 0; i < views.length; i++) {
                var ct = views[i].CollectionType;
                if (ct === 'movies' || ct === 'tvshows' || ct === 'mixed') {
                    libraries.push(views[i]);
                }
            }

            if (libraries.length === 0) {
                picker.innerHTML = '<div class="moonfin-toggle-desc">No media libraries found.</div>';
                return;
            }

            var settings = Storage.getAll();
            var selectedIds = settings.mediaBarLibraryIds || [];
            var html = '';

            for (var j = 0; j < libraries.length; j++) {
                var lib = libraries[j];
                var isChecked = selectedIds.indexOf(lib.Id) !== -1;

                var typeLabel = lib.CollectionType === 'movies' ? 'Movies' : lib.CollectionType === 'tvshows' ? 'Shows' : 'Mixed';

                html +=
                    '<label class="moonfin-collection-item' + (isChecked ? ' moonfin-collection-item-active' : '') + '">' +
                        '<input type="checkbox" data-library-id="' + lib.Id + '"' + (isChecked ? ' checked' : '') + '>' +
                        '<div class="moonfin-collection-poster moonfin-collection-poster-empty" style="display:flex;align-items:center;justify-content:center;font-size:16px;">' +
                            (lib.CollectionType === 'movies' ? '🎬' : lib.CollectionType === 'tvshows' ? '📺' : '📁') +
                        '</div>' +
                        '<div class="moonfin-collection-info">' +
                            '<div class="moonfin-collection-name">' + Settings._esc(lib.Name || 'Untitled') + '</div>' +
                            '<div class="moonfin-collection-type">' + typeLabel + '</div>' +
                        '</div>' +
                    '</label>';
            }

            picker.innerHTML = html;

            // Event delegation for library checkboxes (guard against duplicate listeners on re-render)
            if (!picker._libraryListenerAdded) {
            picker._libraryListenerAdded = true;
            picker.addEventListener('change', function(e) {
                var cb = e.target;
                if (!cb.dataset.libraryId) return;

                var currentIds = Storage.get('mediaBarLibraryIds') || [];
                currentIds = currentIds.slice();
                var id = cb.dataset.libraryId;
                var idx = currentIds.indexOf(id);

                if (cb.checked && idx === -1) {
                    currentIds.push(id);
                } else if (!cb.checked && idx !== -1) {
                    currentIds.splice(idx, 1);
                }

                self.saveSetting('mediaBarLibraryIds', currentIds);

                var label = cb.closest('.moonfin-collection-item');
                if (label) label.classList.toggle('moonfin-collection-item-active', cb.checked);

                self.showToast(cb.checked ? 'Library added' : 'Library removed');
            });
            }
        }).catch(function(e) {
            console.error('[Moonfin] Failed to load library picker:', e);
            picker.innerHTML = '<div class="moonfin-toggle-desc">Failed to load libraries.</div>';
        });
    },

    loadGenrePicker: function() {
        var self = this;
        var picker = this.dialog ? this.dialog.querySelector('#moonfin-genre-picker') : null;
        if (!picker) return;

        picker.innerHTML = '<div class="moonfin-collection-picker-loading">Loading...</div>';

        var serverUrl = (window.ApiClient && window.ApiClient.serverAddress ? window.ApiClient.serverAddress() : '') || '';
        var token = window.ApiClient && window.ApiClient.accessToken ? window.ApiClient.accessToken() : '';
        var headers = token ? { 'Authorization': 'MediaBrowser Token="' + token + '"' } : {};

        fetch(serverUrl + '/Moonfin/Genres', { method: 'GET', headers: headers })
            .then(function(response) {
                if (!response.ok) throw new Error('Failed to fetch genres');
                return response.json();
            })
            .then(function(data) {
                if (!self.dialog) return;

                var genres = data.Items || data.items || [];
                if (genres.length === 0) {
                    picker.innerHTML = '<div class="moonfin-toggle-desc">No genres found in your library.</div>';
                    return;
                }

                var settings = Storage.getAll();
                var excludedGenres = settings.mediaBarExcludedGenres || [];
                var html = '';

                for (var i = 0; i < genres.length; i++) {
                    var genre = genres[i];
                    var genreId = genre.id || genre.Id;
                    var genreName = genre.name || genre.Name;
                    var isExcluded = excludedGenres.indexOf(genreId) !== -1;

                    html +=
                        '<label class="moonfin-collection-item' + (isExcluded ? ' moonfin-collection-item-active' : '') + '">' +
                            '<input type="checkbox" data-genre-id="' + Settings._esc(genreId) + '"' + (isExcluded ? ' checked' : '') + '>' +
                            '<div class="moonfin-collection-poster moonfin-collection-poster-empty" style="display:flex;align-items:center;justify-content:center;font-size:16px;">\ud83d\udeab</div>' +
                            '<div class="moonfin-collection-info">' +
                                '<div class="moonfin-collection-name">' + Settings._esc(genreName) + '</div>' +
                            '</div>' +
                        '</label>';
                }

                picker.innerHTML = html;

                // Guard against duplicate listeners on re-render
                if (!picker._genreListenerAdded) {
                picker._genreListenerAdded = true;
                picker.addEventListener('change', function(e) {
                    var cb = e.target;
                    if (!cb.dataset.genreId) return;

                    var currentExcluded = Storage.get('mediaBarExcludedGenres') || [];
                    currentExcluded = currentExcluded.slice();
                    var id = cb.dataset.genreId;
                    var idx = currentExcluded.indexOf(id);

                    if (cb.checked && idx === -1) {
                        currentExcluded.push(id);
                    } else if (!cb.checked && idx !== -1) {
                        currentExcluded.splice(idx, 1);
                    }

                    self.saveSetting('mediaBarExcludedGenres', currentExcluded);

                    var label = cb.closest('.moonfin-collection-item');
                    if (label) label.classList.toggle('moonfin-collection-item-active', cb.checked);

                    self.showToast(cb.checked ? 'Genre excluded' : 'Genre included');
                });
                }
            })
            .catch(function(e) {
                console.error('[Moonfin] Failed to load genre picker:', e);
                picker.innerHTML = '<div class="moonfin-toggle-desc">Failed to load genres.</div>';
            });
    }
};


// === components/syncplay.js ===
const SyncPlay = {
    container: null,
    isOpen: false,
    initialized: false,
    _group: null,
    _groups: [],
    _refreshInterval: null,
    _wsHandler: null,

    init() {
        if (this.initialized) return;
        this._setupWebSocketListener();
        this.initialized = true;
        console.log('[Moonfin] SyncPlay initialized');
    },

    _request(method, path, body) {
        var api = API.getApiClient();
        if (!api) return Promise.reject(new Error('No API client'));
        var opts = {
            type: method,
            url: api.getUrl('SyncPlay/' + path)
        };
        if (body !== undefined) {
            opts.data = JSON.stringify(body);
            opts.contentType = 'application/json';
        }
        if (method === 'GET') {
            opts.dataType = 'json';
        }
        return api.ajax(opts);
    },

    async listGroups() {
        try {
            var result = await this._request('GET', 'List');
            return Array.isArray(result) ? result : [];
        } catch (e) {
            console.error('[Moonfin] SyncPlay: Failed to list groups', e);
            return [];
        }
    },

    async createGroup(name) {
        try {
            return await this._request('POST', 'New', { GroupName: name });
        } catch (e) {
            console.error('[Moonfin] SyncPlay: Failed to create group', e);
            return null;
        }
    },

    async joinGroup(groupId) {
        try {
            await this._request('POST', 'Join', { GroupId: groupId });
            return true;
        } catch (e) {
            console.error('[Moonfin] SyncPlay: Failed to join group', e);
            return false;
        }
    },

    async leaveGroup() {
        try {
            await this._request('POST', 'Leave');
            this._group = null;
            return true;
        } catch (e) {
            console.error('[Moonfin] SyncPlay: Failed to leave group', e);
            return false;
        }
    },

    async getGroup(groupId) {
        try {
            return await this._request('GET', groupId);
        } catch (e) {
            return null;
        }
    },

    _setupWebSocketListener() {
        var self = this;
        var attempts = 0;
        var tryHook = function() {
            var api = API.getApiClient();
            if (api) {
                self._hookWebSocket(api);
            } else if (attempts < 50) {
                attempts++;
                setTimeout(tryHook, 200);
            }
        };
        tryHook();
    },

    _hookWebSocket(api) {
        var self = this;
        if (self._wsHandler) return;

        self._wsHandler = function(e, msgType, data) {
            if (msgType === 'SyncPlayGroupUpdate') {
                self._handleGroupUpdate(data);
            }
        };

        if (window.Events && typeof window.Events.on === 'function') {
            window.Events.on(api, 'message', self._wsHandler);
        } else {
            var checkEvents = function(retries) {
                if (window.Events && typeof window.Events.on === 'function') {
                    window.Events.on(api, 'message', self._wsHandler);
                } else if (retries > 0) {
                    setTimeout(function() { checkEvents(retries - 1); }, 500);
                }
            };
            checkEvents(20);
        }
    },

    _handleGroupUpdate(data) {
        if (!data) return;
        switch (data.Type) {
            case 'GroupJoined':
                this._group = data.Data;
                console.log('[Moonfin] SyncPlay: Joined group', this._group.GroupName);
                this._updateUI();
                break;
            case 'GroupLeft':
                console.log('[Moonfin] SyncPlay: Left group');
                this._group = null;
                this._updateUI();
                break;
            case 'UserJoined':
            case 'UserLeft':
                this._refreshCurrentGroup();
                break;
            case 'StateUpdate':
                if (this._group && data.Data) {
                    this._group.State = data.Data.State;
                    this._updateUI();
                }
                break;
            case 'PlayQueue':
                this._updateUI();
                break;
            case 'NotInGroup':
            case 'GroupDoesNotExist':
                this._group = null;
                this._updateUI();
                break;
            case 'LibraryAccessDenied':
                console.warn('[Moonfin] SyncPlay: Library access denied');
                break;
        }
    },

    async _refreshCurrentGroup() {
        if (!this._group || !this._group.GroupId) return;
        var updated = await this.getGroup(this._group.GroupId);
        if (updated) {
            this._group = updated;
            this._updateUI();
        }
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.show();
        }
    },

    async show() {
        if (this.isOpen) return;
        if (Device.isTV()) return;
        this.isOpen = true;

        this._groups = await this.listGroups();
        this._createPanel();

        var self = this;
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                if (self.container) {
                    self.container.classList.add('open');
                }
            });
        });

        history.pushState({ moonfinSyncPlay: true }, '');
        if (typeof Plugin !== 'undefined') Plugin._overlayHistoryDepth++;

        this._refreshInterval = setInterval(function() {
            if (self.isOpen && !self._group) {
                self._refreshGroupList();
            }
        }, 5000);
    },

    close(skipHistoryBack) {
        if (!this.isOpen) return;
        this.isOpen = false;

        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }

        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }

        var self = this;
        if (this.container) {
            this.container.classList.remove('open');
            setTimeout(function() {
                if (self.container) {
                    self.container.remove();
                    self.container = null;
                }
            }, 300);
        }

        if (!skipHistoryBack) {
            try { history.back(); } catch (e) {}
        }
    },

    _createPanel() {
        if (this.container) {
            this.container.remove();
        }

        this.container = document.createElement('div');
        this.container.className = 'moonfin-syncplay-overlay';

        this.container.innerHTML = [
            '<div class="moonfin-syncplay-panel">',
            '    <div class="moonfin-syncplay-header">',
            '        <h2 class="moonfin-syncplay-title">SyncPlay</h2>',
            '        <button class="moonfin-syncplay-close" title="Close">&times;</button>',
            '    </div>',
            '    <div class="moonfin-syncplay-content">',
            this._group ? this._renderGroupView() : this._renderLobbyView(),
            '    </div>',
            '</div>'
        ].join('\n');

        document.body.appendChild(this.container);

        var self = this;
        this.container.querySelector('.moonfin-syncplay-close').addEventListener('click', function() {
            self.close();
        });
        this.container.addEventListener('click', function(e) {
            if (e.target === self.container) {
                self.close();
            }
        });
        this._onKeyDown = function(e) {
            if (e.key === 'Escape' && self.isOpen) {
                self.close();
            }
        };
        document.addEventListener('keydown', this._onKeyDown);

        this._bindContentEvents();
    },

    _renderGroupCardHtml(g) {
        var participants = g.Participants ? g.Participants.length : 0;
        var stateLabel = g.State || 'Idle';
        return '<button class="moonfin-syncplay-group-card" data-group-id="' + g.GroupId + '">' +
            '    <div class="moonfin-syncplay-group-info">' +
            '        <span class="moonfin-syncplay-group-name">' + this._escapeHtml(g.GroupName) + '</span>' +
            '        <span class="moonfin-syncplay-group-meta">' + participants + ' member' + (participants !== 1 ? 's' : '') + ' &middot; ' + stateLabel + '</span>' +
            '    </div>' +
            '    <span class="moonfin-syncplay-join-label">Join</span>' +
            '</button>';
    },

    _renderLobbyView() {
        var lines = [
            '<div class="moonfin-syncplay-lobby">',
            '    <div class="moonfin-syncplay-create">',
            '        <input type="text" class="moonfin-syncplay-input" placeholder="Group name..." maxlength="64">',
            '        <button class="moonfin-syncplay-btn moonfin-syncplay-create-btn">Create Group</button>',
            '    </div>',
            '    <div class="moonfin-syncplay-divider"><span>or join an existing group</span></div>',
            '    <div class="moonfin-syncplay-groups">'
        ];

        if (this._groups.length === 0) {
            lines.push('        <div class="moonfin-syncplay-empty">No active groups found</div>');
        } else {
            for (var i = 0; i < this._groups.length; i++) {
                lines.push(this._renderGroupCardHtml(this._groups[i]));
            }
        }

        lines.push('    </div>');
        lines.push('</div>');
        return lines.join('\n');
    },

    _renderGroupView() {
        var g = this._group;
        var participants = g.Participants || [];
        var stateLabel = g.State || 'Idle';

        var lines = [
            '<div class="moonfin-syncplay-group-view">',
            '    <div class="moonfin-syncplay-group-header">',
            '        <h3 class="moonfin-syncplay-group-title">' + this._escapeHtml(g.GroupName) + '</h3>',
            '        <span class="moonfin-syncplay-state moonfin-syncplay-state-' + (g.State || 'Idle').toLowerCase() + '">' + stateLabel + '</span>',
            '    </div>',
            '    <div class="moonfin-syncplay-members">',
            '        <h4 class="moonfin-syncplay-members-title">Members (' + participants.length + ')</h4>',
            '        <ul class="moonfin-syncplay-members-list">'
        ];

        for (var i = 0; i < participants.length; i++) {
            lines.push('            <li class="moonfin-syncplay-member">' + this._escapeHtml(participants[i]) + '</li>');
        }

        lines.push('        </ul>');
        lines.push('    </div>');
        lines.push('    <div class="moonfin-syncplay-controls">');
        lines.push('        <button class="moonfin-syncplay-btn moonfin-syncplay-leave-btn">Leave Group</button>');
        lines.push('    </div>');
        lines.push('</div>');
        return lines.join('\n');
    },

    _bindContentEvents() {
        var self = this;

        var createBtn = this.container.querySelector('.moonfin-syncplay-create-btn');
        var input = this.container.querySelector('.moonfin-syncplay-input');
        if (createBtn && input) {
            createBtn.addEventListener('click', function() {
                var name = input.value.trim();
                if (name) self._handleCreateGroup(name);
            });
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    var name = input.value.trim();
                    if (name) self._handleCreateGroup(name);
                }
            });
        }

        this.container.querySelectorAll('.moonfin-syncplay-group-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var groupId = card.dataset.groupId;
                if (groupId) self._handleJoinGroup(groupId);
            });
        });

        var leaveBtn = this.container.querySelector('.moonfin-syncplay-leave-btn');
        if (leaveBtn) {
            leaveBtn.addEventListener('click', function() {
                self._handleLeaveGroup();
            });
        }
    },

    async _handleCreateGroup(name) {
        var createBtn = this.container ? this.container.querySelector('.moonfin-syncplay-create-btn') : null;
        if (createBtn) createBtn.disabled = true;

        var result = await this.createGroup(name);
        if (result) {
            this._group = result;
            this._updateUI();
        } else {
            if (createBtn) createBtn.disabled = false;
        }
    },

    async _handleJoinGroup(groupId) {
        var card = this.container ? this.container.querySelector('[data-group-id="' + groupId + '"]') : null;
        if (card) card.classList.add('joining');

        var success = await this.joinGroup(groupId);
        if (success) {
            var groupInfo = await this.getGroup(groupId);
            if (groupInfo) {
                this._group = groupInfo;
                this._updateUI();
            }
        } else {
            if (card) card.classList.remove('joining');
        }
    },

    async _handleLeaveGroup() {
        var leaveBtn = this.container ? this.container.querySelector('.moonfin-syncplay-leave-btn') : null;
        if (leaveBtn) leaveBtn.disabled = true;

        await this.leaveGroup();
        this._updateUI();
    },

    async _refreshGroupList() {
        this._groups = await this.listGroups();
        if (!this.isOpen || !this.container || this._group) return;

        var groupsContainer = this.container.querySelector('.moonfin-syncplay-groups');
        if (!groupsContainer) return;

        if (this._groups.length === 0) {
            groupsContainer.innerHTML = '<div class="moonfin-syncplay-empty">No active groups found</div>';
        } else {
            var html = '';
            for (var i = 0; i < this._groups.length; i++) {
                html += this._renderGroupCardHtml(this._groups[i]);
            }
            groupsContainer.innerHTML = html;
        }

        var self = this;
        groupsContainer.querySelectorAll('.moonfin-syncplay-group-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var groupId = card.dataset.groupId;
                if (groupId) self._handleJoinGroup(groupId);
            });
        });
    },

    _updateUI() {
        if (!this.isOpen || !this.container) return;

        var content = this.container.querySelector('.moonfin-syncplay-content');
        if (content) {
            content.innerHTML = this._group ? this._renderGroupView() : this._renderLobbyView();
            this._bindContentEvents();
        }

        this._updateNavButton();
    },

    _updateNavButton() {
        var inGroup = !!this._group;
        var navBtn = document.querySelector('.moonfin-nav-syncplay');
        if (navBtn) navBtn.classList.toggle('active', inGroup);
        var sideBtn = document.querySelector('.moonfin-sidebar-syncplay');
        if (sideBtn) sideBtn.classList.toggle('active', inGroup);
    },

    _escapeHtml(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    destroy() {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = null;
        }
        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        if (this._wsHandler) {
            var api = API.getApiClient();
            if (api && window.Events && typeof window.Events.off === 'function') {
                window.Events.off(api, 'message', this._wsHandler);
            }
            this._wsHandler = null;
        }
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this._group = null;
        this._groups = [];
        this.isOpen = false;
        this.initialized = false;
    }
};


// === components/jellyseerr.js ===
const Jellyseerr = {
    container: null,
    iframe: null,
    isOpen: false,
    config: null,
    ssoStatus: null,

    icons: {
        jellyseerr: '<svg class="moonfin-jellyseerr-icon" viewBox="0 0 96 96" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-opacity="0.13" d="M96.1,48c0,26.31 -21.18,47.71 -47.48,48C22.31,96.28 0.68,75.33 0.11,49.03C-0.45,22.73 20.26,0.87 46.56,0.03c26.3,-0.85 48.37,19.63 49.5,45.92"/><path fill-opacity="0.4" d="M42.87,45.59h-2.49c-3.33,12.42 -4.89,30.36 -4.17,43.88c0.79,14.88 4.85,29.2 6.2,29.2s-0.71,-9.11 0.21,-29.17c0.62,-13.38 4.41,-25.95 4.7,-43.91h-4.46z"/><path fill-opacity="0.4" d="M64.09,45.86h2.49c3.33,12.42 4.89,30.36 4.17,43.88c-0.79,14.88 -4.85,29.2 -6.2,29.2s0.71,-9.11 -0.21,-29.17c-0.62,-13.38 -4.41,-25.95 -4.7,-43.91h4.46z"/><path fill-opacity="0.53" d="M38.05,70.69l-5.06,-1.13s-1.17,7.43 -1.61,11.15c-0.71,6.02 -1.57,14.34 -1.23,20.71c0.37,7.01 2.29,13.76 2.92,13.76s-0.34,-4.29 0.1,-13.75c0.29,-6.3 1.33,-13.87 2.58,-20.72c0.62,-3.38 2.42,-10.02 2.42,-10.02z"/><path fill-opacity="0.53" d="M59.41,70.16h1.55c2.08,7.76 2.47,18.96 2.02,27.4c-0.49,9.29 -3.03,18.23 -3.87,18.23s0.45,-5.69 -0.13,-18.21c-0.39,-8.35 -2.16,-16.2 -2.35,-27.41h2.78z"/><path fill-opacity="0.67" d="M35.18,39.95l-5.67,-2.02s-2.08,13.26 -2.87,19.92c-1.26,10.75 -3.75,25.61 -3.14,36.99c0.67,12.53 4.09,24.58 5.22,24.58s-0.6,-7.67 0.18,-24.56c0.52,-11.26 3.97,-21.94 5.14,-37.01c0.47,-5.99 1.37,-17.9 1.37,-17.9z"/><path fill-opacity="0.67" d="M53.91,45.86l-5.11,0.87s0.68,9.93 0.68,15.58c0,9.16 0.36,18.42 0.33,28.03c-0.03,11.05 1.81,29.55 2.77,29.55s4.06,-23.82 4.72,-38.06c0.44,-9.5 -0.97,-17.84 -1.22,-23.52c-0.22,-5.06 -0.93,-11.88 -0.93,-11.88z"/><path d="M82.09,48.88c0,12.9 -2.19,13.68 -5.78,19.15c-2.58,3.92 2.64,6.96 0.55,8.04c-2.5,1.29 -1.71,-1.05 -6.67,-2.38c-2.15,-0.57 -6.84,0.06 -8.74,0.43c-1.88,0.36 -7.61,-2.83 -9.14,-3.24c-2.27,-0.61 -7.84,2.35 -11.23,2.35s-6.94,-2.96 -11.46,-1.75c-5.36,1.44 -11.83,4.94 -12.81,3.79c-1.88,-2.19 4.1,-3.86 1.88,-7.76c-1.4,-2.47 -6.27,-8.98 -6.41,-15.56c-0.45,-21.16 17.07,-39.03 35.84,-39.03s33.95,16.28 33.95,34.49"/><path fill-rule="evenodd" d="M46.95,19.63c-10.25,0 -24.58,10.61 -24.58,20.86c0,1.14 -0.92,2.06 -2.06,2.06s-2.06,-0.92 -2.06,-2.06c0,-12.52 16.17,-24.98 28.7,-24.98c1.14,0 2.06,0.92 2.06,2.06s-0.92,2.06 -2.06,2.06z"/><path fill-opacity="0.87" d="M62.12,58.41c-1.09,1.78 -2.57,3.21 -4.32,4.19c-0.75,0.41 -1.54,0.74 -2.36,0.98c-2.45,1.1 -5.2,1.69 -7.99,1.75c-9.53,0.17 -17.44,-5.92 -17.75,-13.65c-0.15,-3.79 2.11,-7.72 3.86,-10.75c1.48,-2.56 4.03,-6.97 7.39,-8.73c6.85,-3.6 16.08,0.21 20.7,8.55c1.34,2.42 2.19,5.07 2.48,7.71c0.21,0.86 0.33,1.74 0.34,2.62c0.03,2.29 -0.63,4.55 -1.91,6.58c-0.13,0.26 -0.27,0.51 -0.42,0.75z"/><path d="M47.07,39.46c5.94,0 10.75,4.81 10.75,10.75s-4.81,10.75 -10.75,10.75s-10.75,-4.81 -10.75,-10.75c0,-1.1 0.16,-2.16 0.47,-3.17c0.84,1.87 2.72,3.17 4.9,3.17c2.97,0 5.37,-2.41 5.37,-5.37c0,-2.18 -1.3,-4.06 -3.17,-4.9c1,-0.31 2.06,-0.47 3.17,-0.47z"/></svg>',
        seerr: '<svg class="moonfin-jellyseerr-icon" viewBox="0 0 96 96" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M48 96C74.5097 96 96 74.5097 96 48C96 21.4903 74.5097 0 48 0C21.4903 0 0 21.4903 0 48C0 74.5097 21.4903 96 48 96Z" fill-opacity="0.2"/><circle cx="52" cy="52" r="28" fill-opacity="0.3"/><path fill-rule="evenodd" clip-rule="evenodd" d="M80.0001 52C80.0001 67.464 67.4641 80 52.0001 80C36.5361 80 24.0001 67.464 24.0001 52C24.0001 49.1303 24.4318 46.3615 25.2338 43.7548C27.4288 48.6165 32.3194 52 38.0001 52C45.7321 52 52.0001 45.732 52.0001 38C52.0001 32.3192 48.6166 27.4287 43.755 25.2337C46.3616 24.4317 49.1304 24 52.0001 24C67.4641 24 80.0001 36.536 80.0001 52Z"/><path fill-rule="evenodd" clip-rule="evenodd" d="M48 12C28.1177 12 12 28.1177 12 48C12 50.2091 10.2091 52 8 52C5.79086 52 4 50.2091 4 48C4 23.6995 23.6995 4 48 4C50.2091 4 52 5.79086 52 8C52 10.2091 50.2091 12 48 12Z" fill-opacity="0.5"/><path opacity="0.25" fill-rule="evenodd" clip-rule="evenodd" d="M80.0002 52C80.0002 67.464 67.4642 80 52.0002 80C36.864 80 24.5329 67.9897 24.017 52.9791C24.0057 53.318 24 53.6583 24 54C24 70.5685 37.4315 84 54 84C70.5685 84 84 70.5685 84 54C84 37.4315 70.5685 24 54 24C53.6597 24 53.3207 24.0057 52.9831 24.0169C67.9919 24.5347 80.0002 36.865 80.0002 52Z"/></svg>'
    },

    getIcon(variant) {
        return this.icons[variant] || this.icons.seerr;
    },

    getProxyUrl() {
        var serverUrl = window.ApiClient?.serverAddress?.() || '';
        var token = window.ApiClient?.accessToken?.();
        if (!serverUrl || !token) return null;
        return serverUrl + '/Moonfin/Jellyseerr/Web/?api_key=' + encodeURIComponent(token);
    },

    getIframeUrl() {
        return this.getProxyUrl() || this.config?.url;
    },

    async init() {
        await this.fetchConfig();
        
        if (this.config?.enabled && this.config?.url) {
            await this.checkSsoStatus();
            window.dispatchEvent(new CustomEvent('moonfin-jellyseerr-config', { 
                detail: this.config 
            }));
        }
    },

    async fetchConfig() {
        try {
            const serverUrl = window.ApiClient?.serverAddress?.() || '';
            const token = window.ApiClient?.accessToken?.();
            
            if (!serverUrl || !token) {
                return;
            }

            const deviceInfo = Device.getInfo();
            const params = new URLSearchParams({
                deviceType: deviceInfo.type,
                isMobile: deviceInfo.isMobile,
                hasTouch: deviceInfo.hasTouch
            });

            var response = await fetch(serverUrl + '/Moonfin/Jellyseerr/Config?' + params, {
                method: 'GET',
                headers: {
                    'Authorization': 'MediaBrowser Token="' + token + '"'
                }
            });

            if (response.ok) {
                this.config = API.toCamelCase(await response.json());
            }
        } catch (e) {
            console.error('[Moonfin] Failed to fetch Seerr config:', e);
        }
    },

    async checkSsoStatus() {
        try {
            var serverUrl = window.ApiClient?.serverAddress?.() || '';
            var token = window.ApiClient?.accessToken?.();
            
            if (!serverUrl || !token) return;

            var response = await fetch(serverUrl + '/Moonfin/Jellyseerr/Status', {
                method: 'GET',
                headers: {
                    'Authorization': 'MediaBrowser Token="' + token + '"'
                }
            });

            if (response.ok) {
                this.ssoStatus = API.toCamelCase(await response.json());
            }
        } catch (e) {
            console.error('[Moonfin] Failed to check Seerr SSO status:', e);
        }
    },

    async ssoLogin(username, password, authType) {
        try {
            var serverUrl = window.ApiClient?.serverAddress?.() || '';
            var token = window.ApiClient?.accessToken?.();
            
            if (!serverUrl || !token) {
                return { success: false, error: 'Not authenticated with Jellyfin' };
            }

            var response = await fetch(serverUrl + '/Moonfin/Jellyseerr/Login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'MediaBrowser Token="' + token + '"'
                },
                body: JSON.stringify({ username: username, password: password, authType: authType || 'jellyfin' })
            });

            var result = API.toCamelCase(await response.json());
            
            if (response.ok && result.success) {
                this.ssoStatus = {
                    enabled: true,
                    authenticated: true,
                    url: this.config?.url,
                    jellyseerrUserId: result.jellyseerrUserId,
                    displayName: result.displayName,
                    avatar: result.avatar,
                    permissions: result.permissions
                };
                return { success: true };
            }
            
            return { success: false, error: result.error || 'Authentication failed' };
        } catch (e) {
            console.error('[Moonfin] Seerr SSO login error:', e);
            return { success: false, error: 'Connection error' };
        }
    },

    async ssoLogout() {
        try {
            var serverUrl = window.ApiClient?.serverAddress?.() || '';
            var token = window.ApiClient?.accessToken?.();
            
            if (!serverUrl || !token) return;

            await fetch(serverUrl + '/Moonfin/Jellyseerr/Logout', {
                method: 'DELETE',
                headers: {
                    'Authorization': 'MediaBrowser Token="' + token + '"'
                }
            });

            this.ssoStatus = { enabled: true, authenticated: false, url: this.config?.url };
        } catch (e) {
            console.error('[Moonfin] Seerr SSO logout error:', e);
        }
    },

    async ssoApiCall(method, path, body) {
        var serverUrl = window.ApiClient?.serverAddress?.() || '';
        var token = window.ApiClient?.accessToken?.();
        
        if (!serverUrl || !token) {
            throw new Error('Not authenticated with Jellyfin');
        }

        var options = {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'MediaBrowser Token="' + token + '"'
            }
        };

        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        var response = await fetch(serverUrl + '/Moonfin/Jellyseerr/Api/' + path, options);
        
        if (response.status === 401) {
            // Session expired - clear status
            this.ssoStatus = { enabled: true, authenticated: false, url: this.config?.url };
            throw new Error('SESSION_EXPIRED');
        }

        return response;
    },

    open() {
        if (!this.config?.enabled || !this.config?.url) {
            return;
        }

        if (this.isOpen) return;

        if (!this.ssoStatus?.authenticated) {
            this.showSignInPrompt();
            return;
        }

        this.createContainer();
        this.isOpen = true;

        history.pushState({ moonfinJellyseerr: true }, '');
        if (window.Moonfin && window.Moonfin.Plugin) window.Moonfin.Plugin._overlayHistoryDepth++;
        else if (typeof Plugin !== 'undefined') Plugin._overlayHistoryDepth++;
        document.body.classList.add('moonfin-jellyseerr-open');

        requestAnimationFrame(function() {
            if (Jellyseerr.container) {
                Jellyseerr.container.classList.add('open');
            }
        });
    },

    showSignInPrompt() {
        var existing = document.querySelector('.moonfin-jellyseerr-signin-prompt');
        if (existing) existing.remove();

        var prompt = document.createElement('div');
        prompt.className = 'moonfin-jellyseerr-signin-prompt';
        prompt.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:#1e1e2e; border:1px solid #555; border-radius:8px; padding:1.5em 2em; z-index:100001; text-align:center; color:#fff; box-shadow:0 4px 24px rgba(0,0,0,0.5);';
        prompt.innerHTML =
            '<p style="margin:0 0 1em 0; font-size:1em;">Sign in to Seerr in <strong>Moonfin Settings</strong> first.</p>' +
            '<div style="display:flex; gap:0.5em; justify-content:center;">' +
                '<button class="moonfin-prompt-settings-btn" style="padding:0.5em 1.5em; border:none; border-radius:4px; background:#6366f1; color:#fff; cursor:pointer; font-size:0.9em;">Open Settings</button>' +
                '<button class="moonfin-prompt-close-btn" style="padding:0.5em 1.5em; border:none; border-radius:4px; background:#555; color:#fff; cursor:pointer; font-size:0.9em;">Close</button>' +
            '</div>';

        document.body.appendChild(prompt);

        prompt.querySelector('.moonfin-prompt-close-btn').addEventListener('click', function() {
            prompt.remove();
        });

        prompt.querySelector('.moonfin-prompt-settings-btn').addEventListener('click', function() {
            prompt.remove();
            Settings.show();
        });

        setTimeout(function() {
            if (prompt.parentNode) prompt.remove();
        }, 8000);
    },

    close(skipHistoryBack) {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.container.classList.remove('open');
        document.body.classList.remove('moonfin-jellyseerr-open');

        setTimeout(() => {
            if (this.container) {
                this.container.remove();
                this.container = null;
                this.iframe = null;
            }
        }, 300);

        if (!skipHistoryBack) {
            try { history.back(); } catch(e) {}
        }
    },

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    },

    createContainer() {
        var existing = document.querySelector('.moonfin-jellyseerr-container');
        if (existing) {
            existing.remove();
        }

        this.container = document.createElement('div');
        this.container.className = 'moonfin-jellyseerr-container';
        
        var displayName = this.config?.displayName || 'Seerr';
        var variant = this.config?.variant || 'seerr';
        var ssoUser = this.ssoStatus?.displayName || '';
        var iframeSrc = this.getIframeUrl();
        var iconSvg = this.getIcon(variant);
        
        this.container.innerHTML = 
            '<div class="moonfin-jellyseerr-header">' +
                '<div class="moonfin-jellyseerr-title">' +
                    iconSvg +
                    '<span>' + displayName + '</span>' +
                    (ssoUser ? '<span class="moonfin-jellyseerr-sso-user"> &mdash; ' + ssoUser + '</span>' : '') +
                '</div>' +
                '<div class="moonfin-jellyseerr-actions">' +
                    '<button class="moonfin-jellyseerr-btn moonfin-jellyseerr-refresh" title="Refresh">' +
                        '<svg viewBox="0 0 24 24" width="20" height="20">' +
                            '<path fill="currentColor" d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>' +
                        '</svg>' +
                    '</button>' +
                    '<button class="moonfin-jellyseerr-btn moonfin-jellyseerr-external" title="Open in new tab">' +
                        '<svg viewBox="0 0 24 24" width="20" height="20">' +
                            '<path fill="currentColor" d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>' +
                        '</svg>' +
                    '</button>' +
                    '<button class="moonfin-jellyseerr-btn moonfin-jellyseerr-close" title="Close">' +
                        '<svg viewBox="0 0 24 24" width="20" height="20">' +
                            '<path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>' +
                        '</svg>' +
                    '</button>' +
                '</div>' +
            '</div>' +
            '<div class="moonfin-jellyseerr-loading">' +
                '<div class="moonfin-jellyseerr-spinner"></div>' +
                '<span>Loading ' + displayName + '...</span>' +
            '</div>' +
            '<iframe ' +
                'class="moonfin-jellyseerr-iframe" ' +
                'src="' + iframeSrc + '" ' +
                'allow="fullscreen" ' +
                'sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-popups-to-escape-sandbox"' +
            '></iframe>';

        document.body.appendChild(this.container);
        
        this.iframe = this.container.querySelector('.moonfin-jellyseerr-iframe');
        
        this.setupEventListeners();
    },

    setupEventListeners() {
        var self = this;

        this.container.querySelector('.moonfin-jellyseerr-close')?.addEventListener('click', function() {
            self.close();
        });

        this.container.querySelector('.moonfin-jellyseerr-refresh')?.addEventListener('click', function() {
            self.refresh();
        });

        this.container.querySelector('.moonfin-jellyseerr-external')?.addEventListener('click', function() {
            window.open(self.config.url, '_blank');
        });

        this.iframe?.addEventListener('load', function() {
            self.container.classList.add('loaded');
        });

        this.iframe?.addEventListener('error', function() {
            self.showError('Failed to load. The site may block embedding.');
        });

        this._escHandler = function(e) {
            if (e.key === 'Escape' && self.isOpen) {
                self.close();
            }
        };
        document.addEventListener('keydown', this._escHandler);
    },

    refresh() {
        if (this.iframe) {
            this.container.classList.remove('loaded');
            this.iframe.src = this.getIframeUrl();
        }
    },

    showError(message) {
        const loading = this.container?.querySelector('.moonfin-jellyseerr-loading');
        if (loading) {
            loading.innerHTML = `
                <svg viewBox="0 0 24 24" width="48" height="48" style="color: #f44336;">
                    <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span style="color: #f44336;">${message}</span>
                <button class="moonfin-jellyseerr-btn" onclick="window.open('${this.config.url}', '_blank')">
                    Open in New Tab
                </button>
            `;
            loading.style.display = 'flex';
        }
    },

    destroy() {
        this.close();
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
        }
    }
};


// === components/details.js ===
var Details = {
    container: null,
    currentItem: null,
    isVisible: false,
    _itemHistory: [],
    _navigatingBack: false,
    _trailerOverlay: null,
    _trailerEscHandler: null,
    _trailerPreviousFocus: null,
    _trailerPlayer: null,
    _settingsChangedHandler: null,
    FAVORITE_INDICATOR_SVG: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="m480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z"/></svg>',
    WATCHED_INDICATOR_SVG: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z"/></svg>',

    buildFavoriteIndicator: function() {
        return '<div class="moonfin-favorite-indicator">' + this.FAVORITE_INDICATOR_SVG + '</div>';
    },

    buildWatchedIndicator: function() {
        return '<div class="moonfin-watched-indicator">' + this.WATCHED_INDICATOR_SVG + '</div>';
    },

    init: function() {
        this.createContainer();
        this.setupItemInterception();
        if (!this._settingsChangedHandler) {
            var self = this;
            this._settingsChangedHandler = function() {
                self.applyBackdropSettings();
            };
            window.addEventListener('moonfin-settings-changed', this._settingsChangedHandler);
        }
    },

    createContainer: function() {
        var existing = document.querySelector('.moonfin-details-overlay');
        if (existing) existing.remove();

        this.container = document.createElement('div');
        this.container.className = 'moonfin-details-overlay';
        this.container.innerHTML = '<div class="moonfin-details-backdrop"></div><div class="moonfin-details-panel"></div>';
        document.body.appendChild(this.container);
        this.applyBackdropSettings();
    },

    applyBackdropSettings: function() {
        var backdrop = this.container ? this.container.querySelector('.moonfin-details-backdrop') : null;
        if (!backdrop) return;

        var settings = Storage.getAll();
        var opacity = parseInt(settings.detailsBackdropOpacity, 10);
        if (isNaN(opacity)) opacity = 90;
        opacity = Math.max(0, Math.min(100, opacity));

        var blur = parseInt(settings.detailsBackdropBlur, 10);
        if (isNaN(blur)) blur = 0;
        blur = Math.max(0, Math.min(40, blur));

        var dim = (100 - opacity) / 100;
        backdrop.style.setProperty('--moonfin-details-backdrop-dim', dim.toFixed(2));
        backdrop.style.filter = blur > 0 ? 'blur(' + blur + 'px)' : 'none';
    },

    setupItemInterception: function() {
        var self = this;

        if (!Storage.get('detailsPageEnabled')) {
            return;
        }
        
        var ignoreSelectors = '.videoOsdBottom, .videoOsdTop, .osdHeader, .videoOsd, .subtitleAppearanceDialog, .subtitleSync, .trackSelections, .playerStats, .dialog, .dialogContainer, .focuscontainer-down, .actionSheetContent, .actionSheet, .actionSheetScroller, .videoPlayerContainer, .upNextContainer, .mediaSelectionMenu, .slideshowButtonContainer, .btnVideoOsd, .osdMediaInfo, .osdControls, .skipSegmentContainer, .itemContextMenu, .popupContainer, .toast, .guide, .recordingFields, .formDialogContent, .formDialog, .promptDialog, .confirmDialog, .withPopup, .multiSelectMenu, .moonfin-more-menu, .moonfin-settings-panel';

        document.addEventListener('click', function(e) {
            if (e.target.closest(ignoreSelectors)) {
                return;
            }

            if (document.querySelector('.selectionCommandsPanel')) {
                return;
            }

            var card = e.target.closest('.card, .listItem');
            if (!card) return;

            if (e.target.closest('.cardOverlayButton, .listItemButton, .btnPlayItem, .btnMoreCommands, .btnUserItemRating, .btnItemAction, .paper-icon-button-light, .itemAction[data-action]:not([data-action="link"])')) {
                return;
            }

            if (!card.closest('.homeSection, .section, .itemsContainer, .cardContainer, .listTopPager, .vertical-list, .vertical-wrap, .prefContainer, .libraryPage, .pageTabContent, .sectionTitleContainer, .moonfin-details-panel, .moonfin-mediabar')) {
                return;
            }

            var itemId = self.getItemIdFromCard(card);
            if (!itemId) return;
            if (!self.isLikelyJellyfinItemId(itemId)) return;

            var cardType = card.getAttribute('data-type') || 
                          (card.querySelector('[data-type]') ? card.querySelector('[data-type]').getAttribute('data-type') : null) ||
                          self.inferCardType(card);
            
            if (['Movie', 'Series', 'Episode', 'Season'].indexOf(cardType) !== -1) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                self.showDetails(itemId, cardType);
                return false;
            }
            if (!cardType && card.classList.contains('card')) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                self.showDetails(itemId, null);
                return false;
            }
        }, true);

        document.addEventListener('click', function(e) {
            if (e.target.closest(ignoreSelectors)) {
                return;
            }

            if (document.querySelector('.selectionCommandsPanel')) {
                return;
            }

            var link = e.target.closest('a[href*="id="], a[href*="/details"]');
            if (!link) return;
            
            var card = link.closest('.card, .listItem');
            if (!card) return;
            
            var itemId = self.getItemIdFromCard(card) || self.getItemIdFromLink(link);
            if (!itemId) return;
            if (!self.isLikelyJellyfinItemId(itemId)) return;
            
            var cardType = card.getAttribute('data-type') || self.inferCardType(card);
            
            if (!cardType || ['Movie', 'Series', 'Episode', 'Season'].indexOf(cardType) !== -1) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                self.showDetails(itemId, cardType);
                return false;
            }
        }, true);

        document.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.keyCode === 13) {
                if (e.target.closest(ignoreSelectors)) {
                    return;
                }

                var focused = document.activeElement;
                var card = (focused ? focused.closest('.card, .listItem') : null) || 
                          (focused && focused.classList.contains('card') ? focused : null);
                
                if (card) {
                    var itemId = self.getItemIdFromCard(card);
                    var cardType = card.getAttribute('data-type') || self.inferCardType(card);
                    
                    if (itemId && (!cardType || ['Movie', 'Series', 'Episode', 'Season'].indexOf(cardType) !== -1)) {
                        if (!self.isLikelyJellyfinItemId(itemId)) return;
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        self.showDetails(itemId, cardType);
                        return false;
                    }
                }
            }
        }, true);

        // Close on back button - keyCodes 461 (LG) and 10009 (Samsung) are TV remote back buttons
        document.addEventListener('keydown', function(e) {
            if (self.isVisible && (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009)) {
                e.preventDefault();
                e.stopPropagation();
                if (self.closeTrailerOverlay()) {
                    return;
                }
                self.hide();
            }
        }, true);
    },

    getItemIdFromCard: function(card) {
        var idFromAttr = card.getAttribute('data-id') || card.getAttribute('data-itemid');
        if (idFromAttr) return idFromAttr;
        
        var dataIdEl = card.querySelector('[data-id]');
        if (dataIdEl) return dataIdEl.getAttribute('data-id');
        
        var link = card.querySelector('a');
        return this.getItemIdFromLink(link);
    },

    getItemIdFromLink: function(link) {
        if (!link || !link.href) return null;
        var match = link.href.match(/id=([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i) || 
                   link.href.match(/\/details\?id=([a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i) ||
                   link.href.match(/\/([a-f0-9]{32})/i);
        return match ? match[1] : null;
    },

    isLikelyJellyfinItemId: function(itemId) {
        if (!itemId || typeof itemId !== 'string') return false;
        return /^[a-f0-9]{32}$/i.test(itemId) ||
               /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(itemId);
    },

    inferCardType: function(card) {
        var classList = card.className.toLowerCase();
        if (classList.indexOf('movie') !== -1) return 'Movie';
        if (classList.indexOf('series') !== -1) return 'Series';
        if (classList.indexOf('episode') !== -1) return 'Episode';
        if (classList.indexOf('season') !== -1) return 'Season';
        
        var section = card.closest('.homeSection, .section');
        if (section) {
            var sectionTitle = section.querySelector('.sectionTitle');
            var title = sectionTitle ? sectionTitle.textContent.toLowerCase() : '';
            if (title.indexOf('movie') !== -1) return 'Movie';
            if (title.indexOf('series') !== -1 || title.indexOf('show') !== -1) return 'Series';
            if (title.indexOf('episode') !== -1) return 'Episode';
        }
        
        return null;
    },

    goBack: function() {
        if (this._itemHistory.length > 0) {
            var prev = this._itemHistory.pop();
            this._navigatingBack = true;
            this.showDetails(prev.id, prev.type);
            this._navigatingBack = false;
        } else {
            this.hide();
        }
    },

    _updateBackButtons: function() {
        var navbarBack = document.querySelector('.moonfin-details-nav-back');
        var sidebarBack = document.querySelector('.moonfin-details-sidebar-back');
        var show = this.isVisible;
        if (navbarBack) navbarBack.style.display = show ? '' : 'none';
        if (sidebarBack) sidebarBack.style.display = show ? '' : 'none';
    },

    showDetails: function(itemId, itemType) {
        var self = this;
        this.closeTrailerOverlay();

        var api = API.getApiClient();
        if (!api) return;

        var wasAlreadyVisible = this.isVisible;

        if (wasAlreadyVisible && this.currentItem && this.currentItem.Id && this.currentItem.Id !== itemId && !this._navigatingBack) {
            this._itemHistory.push({ id: this.currentItem.Id, type: this.currentItem.Type });
        }

        this.container.classList.add('visible');
        this.isVisible = true;
        document.body.classList.add('moonfin-details-visible');
        this._updateBackButtons();

        if (!wasAlreadyVisible) {
            history.pushState({ moonfinDetails: true }, '');
            if (window.Moonfin && window.Moonfin.Plugin) window.Moonfin.Plugin._overlayHistoryDepth++;
            else if (typeof Plugin !== 'undefined') Plugin._overlayHistoryDepth++;
        }

        var panel = this.container.querySelector('.moonfin-details-panel');
        panel.innerHTML = '<div class="moonfin-details-loading"><div class="moonfin-spinner"></div><span>Loading...</span></div>';

        this.fetchItem(api, itemId).then(function(item) {
            self.currentItem = item;

            var supportedTypes = ['Movie', 'Series', 'Episode', 'Season', 'Person', 'BoxSet'];
            if (supportedTypes.indexOf(item.Type) === -1) {
                self.hide(true);
                API.navigateToItem(itemId);
                return;
            }

            if (item.Type === 'Person') {
                var personItemsPromise = self.fetchPersonItems(api, itemId).catch(function() { return []; });
                return personItemsPromise.then(function(personItems) {
                    self.renderPersonDetails(item, personItems);

                    setTimeout(function() {
                        var firstBtn = panel.querySelector('.moonfin-btn, .moonfin-btn-wrapper, .moonfin-focusable');
                        if (firstBtn) firstBtn.focus();
                    }, 100);
                });
            }

            var similarPromise = self.fetchSimilar(api, itemId).catch(function() { return []; });
            var castPromise = Promise.resolve(item.People || []);
            var seasonsPromise = item.Type === 'Series' ? self.fetchSeasons(api, itemId).catch(function() { return []; }) : Promise.resolve([]);
            var episodesPromise = (item.Type === 'Episode' && item.SeasonId) ? self.fetchEpisodes(api, item.SeriesId, item.SeasonId).catch(function() { return []; }) : ((item.Type === 'Season' && item.SeriesId) ? self.fetchEpisodes(api, item.SeriesId, item.Id).catch(function() { return []; }) : Promise.resolve([]));

            return Promise.all([similarPromise, castPromise, seasonsPromise, episodesPromise]).then(function(results) {
                var similar = results[0];
                var cast = results[1];
                var seasons = results[2];
                var episodes = results[3];
                
                if (item.Type === 'Season') {
                    self.renderSeasonDetails(item, episodes);
                } else {
                    self.renderDetails(item, similar, cast, seasons, episodes, [], { title: '', items: [] });
                    Promise.all([
                        self.fetchSpecialFeatures(api, item).catch(function() { return []; }),
                        self.fetchCollectionItems(api, item).catch(function() { return { title: '', items: [] }; })
                    ]).then(function(auxResults) {
                        if (!self.currentItem || self.currentItem.Id !== item.Id) return;

                        var features = auxResults[0] || [];
                        var collections = auxResults[1] || { title: '', items: [] };
                        var hasFeatures = features.length > 0;
                        var hasCollectionItems = collections && collections.items && collections.items.length > 0;

                        if (!hasFeatures && !hasCollectionItems) return;
                        self.renderDetails(item, similar, cast, seasons, episodes, features, collections);
                    });
                }

                if (MdbList.isEnabled()) {
                    MdbList.fetchRatings(item).then(function(ratings) {
                        if (ratings && ratings.length > 0 && self.currentItem && self.currentItem.Id === item.Id) {
                            self.renderMdbListRatings(ratings);
                        }
                    });
                }

                if (Tmdb.isEnabled() && item.Type === 'Episode') {
                    Tmdb.fetchRatingForEpisode(item).then(function(rating) {
                        if (rating && self.currentItem && self.currentItem.Id === item.Id) {
                            self.renderTmdbEpisodeRating(rating);
                        }
                    });
                    if (item.SeriesId && episodes.length > 0) {
                        self.fetchTmdbRatingsForEpisodeList(item, episodes);
                    }
                }

                setTimeout(function() {
                    var firstBtn = panel.querySelector('.moonfin-btn');
                    if (firstBtn) firstBtn.focus();
                }, 100);
            });
        }).catch(function(err) {
            console.error('[Moonfin] Details: Error loading item', err);
            panel.innerHTML = '<div class="moonfin-details-error"><span>Failed to load details</span><button class="moonfin-btn moonfin-focusable" onclick="Details.hide()">Close</button></div>';
        });
    },

    fetchItem: function(api, itemId) {
        var userId = api.getCurrentUserId();
        return api.getItem(userId, itemId);
    },

    fetchSimilar: function(api, itemId) {
        var userId = api.getCurrentUserId();
        return api.getSimilarItems(itemId, {
            userId: userId,
            limit: 12,
            fields: 'PrimaryImageAspectRatio,UserData'
        }).then(function(result) {
            return result.Items || [];
        });
    },

    fetchSeasons: function(api, seriesId) {
        var userId = api.getCurrentUserId();
        return api.getSeasons(seriesId, {
            userId: userId,
            fields: 'PrimaryImageAspectRatio,UserData'
        }).then(function(result) {
            return result.Items || [];
        });
    },

    fetchEpisodes: function(api, seriesId, seasonId) {
        var userId = api.getCurrentUserId();
        var serverUrl = api._serverAddress || api.serverAddress();
        var headers = this.getAuthHeaders();

        return fetch(serverUrl + '/Shows/' + seriesId + '/Episodes?UserId=' + userId + '&SeasonId=' + seasonId + '&Fields=Overview,PrimaryImageAspectRatio', {
            headers: headers
        }).then(function(resp) {
            return resp.json();
        }).then(function(result) {
            return result.Items || [];
        });
    },

    fetchPersonItems: function(api, personId) {
        var userId = api.getCurrentUserId();
        var serverUrl = api._serverAddress || api.serverAddress();
        var headers = this.getAuthHeaders();

        return fetch(serverUrl + '/Users/' + userId + '/Items?PersonIds=' + personId + '&Recursive=true&IncludeItemTypes=Movie,Series&SortBy=PremiereDate,SortName&SortOrder=Descending&Fields=PrimaryImageAspectRatio,Overview&Limit=50', {
            headers: headers
        }).then(function(resp) {
            return resp.json();
        }).then(function(result) {
            return result.Items || [];
        });
    },

    fetchSpecialFeatures: function(api, item) {
        if (!item || !item.Id) return Promise.resolve([]);
        if (!item.SpecialFeatureCount) return Promise.resolve([]);

        var userId = api.getCurrentUserId();
        var serverUrl = api._serverAddress || api.serverAddress();
        var headers = this.getAuthHeaders();

        return fetch(serverUrl + '/Users/' + userId + '/Items/' + item.Id + '/SpecialFeatures?Fields=PrimaryImageAspectRatio,UserData', {
            headers: headers
        }).then(function(resp) {
            if (!resp.ok) throw new Error('Failed to fetch special features');
            return resp.json();
        }).then(function(result) {
            if (Array.isArray(result)) return result;
            return result.Items || [];
        });
    },

    fetchCollectionItems: function(api, item) {
        if (!item || !item.Id) return Promise.resolve({ title: '', items: [] });

        var type = item.Type;
        var supportsCollections = ['Movie', 'Series', 'BoxSet'];
        if (supportsCollections.indexOf(type) === -1) {
            return Promise.resolve({ title: '', items: [] });
        }

        var userId = api.getCurrentUserId();
        var serverUrl = api._serverAddress || api.serverAddress();
        var headers = this.getAuthHeaders();
        var self = this;

        if (type === 'BoxSet') {
            return fetch(serverUrl + '/Users/' + userId + '/Items?ParentId=' + item.Id + '&SortBy=SortName&SortOrder=Ascending&Fields=PrimaryImageAspectRatio,UserData', {
                headers: headers
            }).then(function(resp) {
                if (!resp.ok) throw new Error('Failed to fetch boxset items');
                return resp.json();
            }).then(function(result) {
                var items = result.Items || [];
                return {
                    title: item.Name || 'Collection',
                    items: items
                };
            });
        }

        return self._findBoxSetForItem(serverUrl, userId, headers, item).then(function(boxSet) {
            if (!boxSet || !boxSet.Id) {
                return { title: '', items: [] };
            }

            return fetch(serverUrl + '/Users/' + userId + '/Items?ParentId=' + boxSet.Id + '&SortBy=PremiereDate,SortName&SortOrder=Ascending&Fields=PrimaryImageAspectRatio,UserData', {
                headers: headers
            }).then(function(itemsResp) {
                if (!itemsResp.ok) throw new Error('Failed to fetch parent collection items');
                return itemsResp.json();
            }).then(function(result) {
                return {
                    title: boxSet.Name || 'Collection',
                    items: result.Items || []
                };
            });
        }).catch(function() {
            return { title: '', items: [] };
        });
    },

    _findBoxSetForItem: function(serverUrl, userId, headers, item) {
        return fetch(serverUrl + '/Users/' + userId + '/Items?Ids=' + item.Id + '&IncludeItemTypes=Movie,Series,BoxSet&Recursive=true&CollapseBoxSetItems=true&Fields=BasicSyncInfo', {
            headers: headers
        }).then(function(resp) {
            if (!resp.ok) return null;
            return resp.json();
        }).then(function(result) {
            var items = (result && result.Items) || [];
            for (var i = 0; i < items.length; i++) {
                if (items[i] && items[i].Type === 'BoxSet' && items[i].Id) {
                    return items[i];
                }
            }

            return fetch(serverUrl + '/Users/' + userId + '/Items?IncludeItemTypes=BoxSet&Recursive=true&SortBy=SortName&Fields=BasicSyncInfo', {
                headers: headers
            }).then(function(resp) {
                if (!resp.ok) return null;
                return resp.json();
            }).then(function(boxSetsResult) {
                var boxSets = (boxSetsResult && boxSetsResult.Items) || [];
                if (boxSets.length === 0) return null;

                var checkBoxSet = function(index) {
                    if (index >= boxSets.length) return Promise.resolve(null);
                    var bs = boxSets[index];
                    if (!bs || !bs.Id) return checkBoxSet(index + 1);

                    return fetch(serverUrl + '/Users/' + userId + '/Items?ParentId=' + bs.Id + '&Fields=BasicSyncInfo', {
                        headers: headers
                    }).then(function(resp) {
                        if (!resp.ok) return checkBoxSet(index + 1);
                        return resp.json();
                    }).then(function(childrenResult) {
                        var children = (childrenResult && childrenResult.Items) || [];
                        for (var j = 0; j < children.length; j++) {
                            if (children[j] && children[j].Id === item.Id) {
                                return bs;
                            }
                        }
                        return checkBoxSet(index + 1);
                    });
                };

                return checkBoxSet(0);
            });
        }).catch(function() {
            return null;
        });
    },

    renderDetails: function(item, similar, cast, seasons, episodes, features, collections) {
        var self = this;
        var panel = this.container.querySelector('.moonfin-details-panel');
        var api = API.getApiClient();
        var serverUrl = api._serverAddress;

        var backdropId = (item.BackdropImageTags && item.BackdropImageTags.length > 0) ? item.Id : 
                        (item.ParentBackdropItemId || item.Id);
        var backdropUrl = serverUrl + '/Items/' + backdropId + '/Images/Backdrop?maxWidth=1920&quality=90';
        
        var posterId = item.Id;
        var posterTag = item.ImageTags ? item.ImageTags.Primary : null;
        var isEpisodeThumb = (item.Type === 'Episode');
        var thumbTag = item.ImageTags ? item.ImageTags.Thumb : null;
        var posterUrl;
        if (isEpisodeThumb && thumbTag) {
            posterUrl = serverUrl + '/Items/' + posterId + '/Images/Thumb?maxWidth=500&quality=90';
        } else if (isEpisodeThumb && posterTag) {
            // Episode without Thumb — use Primary but it'll display in landscape container
            posterUrl = serverUrl + '/Items/' + posterId + '/Images/Primary?maxWidth=500&quality=90';
        } else {
            posterUrl = posterTag ? serverUrl + '/Items/' + posterId + '/Images/Primary?maxHeight=500&quality=90' : '';
        }
        
        var logoTag = item.ImageTags ? item.ImageTags.Logo : null;
        var logoUrl = logoTag ? serverUrl + '/Items/' + item.Id + '/Images/Logo?maxWidth=400&quality=90' : null;

        var runtime = item.RunTimeTicks ? this.formatRuntime(item.RunTimeTicks) : '';
        
        var year = item.ProductionYear || (item.PremiereDate ? new Date(item.PremiereDate).getFullYear() : '');
        
        var rating = item.OfficialRating || '';
        
        var communityRating = item.CommunityRating ? item.CommunityRating.toFixed(1) : '';
        
        var criticRating = item.CriticRating;
        
        var genres = (item.Genres || []).join(', ');
        
        var directors = (item.People || []).filter(function(p) { return p.Type === 'Director'; })
            .map(function(p) { return p.Name; }).join(', ');
        
        var writers = (item.People || []).filter(function(p) { return p.Type === 'Writer'; })
            .map(function(p) { return p.Name; }).join(', ');
        
        var studios = (item.Studios || []).map(function(s) { return s.Name; }).join(', ');
        
        var tagline = (item.Taglines && item.Taglines.length > 0) ? item.Taglines[0] : '';
        
        var badges = this.getMediaBadges(item);
        
        var isFavorite = item.UserData ? item.UserData.IsFavorite : false;
        var isPlayed = item.UserData ? item.UserData.Played : false;
        var resumePosition = item.UserData ? (item.UserData.PlaybackPositionTicks || 0) : 0;
        var hasResume = resumePosition > 0;
        var isEpisode = item.Type === 'Episode';
        var isSeries = item.Type === 'Series';
        var seasonCount = item.ChildCount || seasons.length || 0;

        var infoItems = [];
        if (year) infoItems.push('<span class="moonfin-info-item">' + year + '</span>');
        if (rating) infoItems.push('<span class="moonfin-info-pill">' + rating + '</span>');
        if (runtime && item.Type !== 'Series') infoItems.push('<span class="moonfin-info-item">' + runtime + '</span>');
        if (communityRating) infoItems.push('<span class="moonfin-info-item moonfin-star-rating"><svg viewBox="0 -960 960 960" fill="currentColor" width="16" height="16"><path d="m354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Z"/></svg> ' + communityRating + '</span>');
        if (isSeries && seasonCount > 0) {
            infoItems.push('<span class="moonfin-info-item">' + seasonCount + ' Season' + (seasonCount !== 1 ? 's' : '') + '</span>');
        }
        badges.forEach(function(badge) { infoItems.push(badge); });
        var infoRowHtml = infoItems.length > 0 ? '<div class="moonfin-info-row">' + infoItems.join('') + '</div>' : '';

        var episodeHeader = '';
        if (isEpisode) {
            var epInfo = '';
            if (item.ParentIndexNumber !== undefined && item.IndexNumber !== undefined) {
                epInfo = 'S' + item.ParentIndexNumber + ' E' + item.IndexNumber;
            }
            episodeHeader = '<div class="moonfin-episode-header">' +
                (item.SeriesName ? '<span class="moonfin-series-name">' + item.SeriesName + '</span>' : '') +
                (epInfo ? '<span class="moonfin-episode-number">' + epInfo + '</span>' : '') +
            '</div>';
        }

        var actionBtns = [];
        
        if (hasResume) {
            actionBtns.push(
                '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="play" tabindex="0">' +
                    '<div class="moonfin-btn-circle moonfin-btn-primary">' +
                        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                    '</div>' +
                    '<span class="moonfin-btn-label">Resume</span>' +
                '</div>'
            );
        }
        
        actionBtns.push(
            '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="' + (hasResume ? 'restart' : 'play') + '" tabindex="0">' +
                '<div class="moonfin-btn-circle">' +
                    (hasResume ?
                        '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480-80q-75 0-140.5-28.5t-114-77q-48.5-48.5-77-114T120-440h80q0 117 81.5 198.5T480-160q117 0 198.5-81.5T760-440q0-117-81.5-198.5T480-720h-6l62 62-56 58-160-160 160-160 56 58-62 62h6q75 0 140.5 28.5t114 77q48.5 48.5 77 114T840-440q0 75-28.5 140.5t-77 114q-48.5 48.5-114 77T480-80Z"/></svg>' :
                        '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>') +
                '</div>' +
                '<span class="moonfin-btn-label">' + (hasResume ? 'Restart' : 'Play') + '</span>' +
            '</div>'
        );
        
        var hasTrailer = (item.RemoteTrailers && item.RemoteTrailers.length > 0) || (item.LocalTrailerCount > 0);
        if (hasTrailer) {
            actionBtns.push(
                '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="trailer" tabindex="0">' +
                    '<div class="moonfin-btn-circle">' +
                        '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M160-120v-720h80v80h80v-80h320v80h80v-80h80v720h-80v-80h-80v80H320v-80h-80v80h-80Zm80-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80Zm400 320h80v-80h-80v80Zm0-160h80v-80h-80v80Zm0-160h80v-80h-80v80ZM400-200h160v-560H400v560Zm0-560h160-160Z"/></svg>' +
                    '</div>' +
                    '<span class="moonfin-btn-label">Trailer</span>' +
                '</div>'
            );
        }

        if (isSeries) {
            actionBtns.push(
                '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="shuffle" tabindex="0">' +
                    '<div class="moonfin-btn-circle">' +
                        '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M560-160v-80h104L537-367l57-57 126 126v-102h80v240H560Zm-344 0-56-56 504-504H560v-80h240v240h-80v-104L216-160Zm151-377L160-744l56-56 207 207-56 56Z"/></svg>' +
                    '</div>' +
                    '<span class="moonfin-btn-label">Shuffle</span>' +
                '</div>'
            );
        }
        
        actionBtns.push(
            '<div class="moonfin-btn-wrapper moonfin-focusable ' + (isPlayed ? 'active' : '') + '" data-action="played" tabindex="0">' +
                '<div class="moonfin-btn-circle">' +
                    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z"/></svg>' +
                '</div>' +
                '<span class="moonfin-btn-label">' + (isPlayed ? 'Watched' : 'Unwatched') + '</span>' +
            '</div>'
        );
        
        actionBtns.push(
            '<div class="moonfin-btn-wrapper moonfin-focusable ' + (isFavorite ? 'active' : '') + '" data-action="favorite" tabindex="0">' +
                '<div class="moonfin-btn-circle">' +
                    '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="' + (isFavorite ? 
                        'm480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z' :
                        'M480-120q-14 0-28.5-5T426-140q-43-38-97.5-82.5T232-308q-41.5-41.5-72-83T122-475q-8-32-11-60.5T108-596q0-86 57-147t147-61q52 0 99 22t69 62q22-40 69-62t99-22q90 0 147 61t57 147q0 32-3 60.5T837-475q-7 42-37.5 83.5T728-308q-42 42-96.5 86.5T534-140q-11 10-25.5 15t-28.5 5Zm0-80q41-37 88.5-75t83-68.5q35.5-30.5 61-58T746-456q9-27 11.5-49t2.5-43q0-53-34.5-91.5T636-678q-43 0-77.5 24T507-602h-54q-17-28-51.5-52T324-678q-55 0-89.5 38.5T200-548q0 21 2.5 43t11.5 49q9 27 34.5 54.5t61 58Q345-313 392.5-275T480-200Z') +
                    '"/></svg>' +
                '</div>' +
                '<span class="moonfin-btn-label">' + (isFavorite ? 'Favorited' : 'Favorite') + '</span>' +
            '</div>'
        );
        
        if (item.MediaSources && item.MediaSources.length > 1) {
            this._selectedMediaSourceId = item.MediaSources[0].Id;
            actionBtns.push(
                '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="version" tabindex="0">' +
                    '<div class="moonfin-btn-circle">' +
                        '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M320-280h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-480H520ZM240-800v160-160 640-640Z"/></svg>' +
                    '</div>' +
                    '<span class="moonfin-btn-label">' + (item.MediaSources[0].Name || 'Version') + '</span>' +
                '</div>'
            );
        } else {
            this._selectedMediaSourceId = (item.MediaSources && item.MediaSources[0]) ? item.MediaSources[0].Id : null;
        }

        var selectedMediaSource = this._getSelectedMediaSource(item);
        var mediaStreams = this._getMediaStreams(item);

        var audioTracks = mediaStreams.filter(function(s) { return s.Type === 'Audio'; });
        if (audioTracks.length > 1) {
            var defaultAudio = selectedMediaSource ? selectedMediaSource.DefaultAudioStreamIndex : null;
            var selectedAudioTrack = null;
            for (var ai = 0; ai < audioTracks.length; ai++) {
                if (audioTracks[ai].Index === defaultAudio) { selectedAudioTrack = audioTracks[ai]; break; }
            }
            var audioLabel = selectedAudioTrack ? (selectedAudioTrack.DisplayTitle || 'Audio') : 'Audio';
            actionBtns.push(
                '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="audio" tabindex="0">' +
                    '<div class="moonfin-btn-circle">' +
                        '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-422h240v160H560v400q0 66-47 113t-113 47Z"/></svg>' +
                    '</div>' +
                    '<span class="moonfin-btn-label">' + audioLabel + '</span>' +
                '</div>'
            );
            this._selectedAudioIndex = defaultAudio;
        } else {
            this._selectedAudioIndex = null;
        }

        var subtitleTracks = mediaStreams.filter(function(s) { return s.Type === 'Subtitle'; });
        if (subtitleTracks.length > 0) {
            var defaultSub = selectedMediaSource ? selectedMediaSource.DefaultSubtitleStreamIndex : -1;
            if (defaultSub == null) defaultSub = -1;
            var selectedSubTrack = null;
            for (var si = 0; si < subtitleTracks.length; si++) {
                if (subtitleTracks[si].Index === defaultSub) { selectedSubTrack = subtitleTracks[si]; break; }
            }
            var subLabel = defaultSub === -1 ? 'Off' : (selectedSubTrack ? (selectedSubTrack.DisplayTitle || 'Subtitles') : 'Subtitles');
            actionBtns.push(
                '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="subtitle" tabindex="0">' +
                    '<div class="moonfin-btn-circle">' +
                        '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M200-160q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h560q33 0 56.5 23.5T840-720v480q0 33-23.5 56.5T760-160H200Zm0-80h560v-480H200v480Zm80-120h120q17 0 28.5-11.5T440-400v-40h-60v20h-80v-120h80v20h60v-40q0-17-11.5-28.5T400-600H280q-17 0-28.5 11.5T240-560v160q0 17 11.5 28.5T280-360Zm280 0h120q17 0 28.5-11.5T720-400v-40h-60v20h-80v-120h80v20h60v-40q0-17-11.5-28.5T680-600H560q-17 0-28.5 11.5T520-560v160q0 17 11.5 28.5T560-360ZM200-240v-480 480Z"/></svg>' +
                    '</div>' +
                    '<span class="moonfin-btn-label">' + subLabel + '</span>' +
                '</div>'
            );
            this._selectedSubtitleIndex = defaultSub;
        } else {
            this._selectedSubtitleIndex = -1;
        }

        if (isEpisode && item.SeriesId) {
            actionBtns.push(
                '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="series" tabindex="0">' +
                    '<div class="moonfin-btn-circle">' +
                        '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M320-120v-80l40-40H160q-33 0-56.5-23.5T80-320v-440q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v440q0 33-23.5 56.5T800-240H680l40 40v80H320Z"/></svg>' +
                    '</div>' +
                    '<span class="moonfin-btn-label">Go to Series</span>' +
                '</div>'
            );
        }
        
        actionBtns.push(
            '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="more" tabindex="0">' +
                '<div class="moonfin-btn-circle">' +
                    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>' +
                '</div>' +
                '<span class="moonfin-btn-label">More</span>' +
            '</div>'
        );

        var metadataRows = [];
        if (genres) metadataRows.push('<div class="moonfin-metadata-cell"><span class="moonfin-metadata-label">Genres</span><span class="moonfin-metadata-value">' + genres + '</span></div>');
        if (directors) metadataRows.push('<div class="moonfin-metadata-cell"><span class="moonfin-metadata-label">Director</span><span class="moonfin-metadata-value">' + directors + '</span></div>');
        if (writers) metadataRows.push('<div class="moonfin-metadata-cell"><span class="moonfin-metadata-label">Writers</span><span class="moonfin-metadata-value">' + writers + '</span></div>');
        if (studios) metadataRows.push('<div class="moonfin-metadata-cell"><span class="moonfin-metadata-label">Studio</span><span class="moonfin-metadata-value">' + studios + '</span></div>');
        if (runtime) metadataRows.push('<div class="moonfin-metadata-cell"><span class="moonfin-metadata-label">Runtime</span><span class="moonfin-metadata-value">' + runtime + '</span></div>');
        if (isSeries && seasonCount > 0) metadataRows.push('<div class="moonfin-metadata-cell"><span class="moonfin-metadata-label">Seasons</span><span class="moonfin-metadata-value">' + seasonCount + '</span></div>');
        
        var metadataHtml = metadataRows.length > 0 ? '<div class="moonfin-metadata-group">' + metadataRows.join('') + '</div>' : '';

        var arrowsHtml = '<div class="moonfin-section-arrows">' +
            '<button class="moonfin-section-arrow moonfin-arrow-left" aria-label="Scroll left">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>' +
            '</button>' +
            '<button class="moonfin-section-arrow moonfin-arrow-right" aria-label="Scroll right">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>' +
            '</button>' +
        '</div>';

        var castHtml = cast.slice(0, 15).map(function(person) {
            var personImg = person.PrimaryImageTag ? 
                serverUrl + '/Items/' + person.Id + '/Images/Primary?maxHeight=280&quality=80' : '';
            return '<div class="moonfin-cast-card moonfin-focusable" data-person-id="' + person.Id + '" tabindex="0">' +
                '<div class="moonfin-cast-photo">' +
                    (personImg ? '<img src="' + personImg + '" alt="" loading="lazy">' : '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4"/></svg>') +
                '</div>' +
                '<span class="moonfin-cast-name">' + person.Name + '</span>' +
                '<span class="moonfin-cast-role">' + (person.Role || person.Type || '') + '</span>' +
            '</div>';
        }).join('');

        var similarHtml = similar.slice(0, 12).map(function(sim) {
            var simPosterTag = sim.ImageTags ? sim.ImageTags.Primary : null;
            var simPosterUrl = simPosterTag ? serverUrl + '/Items/' + sim.Id + '/Images/Primary?maxHeight=400&quality=80' : '';
            var simWatched = sim.UserData && sim.UserData.Played;
            var simFavorite = sim.UserData && sim.UserData.IsFavorite;
            return '<div class="moonfin-similar-card moonfin-focusable" data-item-id="' + sim.Id + '" data-type="' + sim.Type + '" tabindex="0">' +
                '<div class="moonfin-similar-poster">' +
                    (simPosterUrl ? '<img src="' + simPosterUrl + '" alt="" loading="lazy">' : '') +
                    (simFavorite ? self.buildFavoriteIndicator() : '') +
                    (simWatched ? self.buildWatchedIndicator() : '') +
                '</div>' +
                '<span class="moonfin-similar-title">' + sim.Name + '</span>' +
            '</div>';
        }).join('');

        var seasonsHtml = seasons.length > 0 ? (
            '<div class="moonfin-section">' +
                '<div class="moonfin-section-header">' +
                    '<h3 class="moonfin-section-title">Seasons</h3>' +
                    arrowsHtml +
                '</div>' +
                '<div class="moonfin-section-scroll">' +
                    seasons.map(function(season) {
                        var seasonPosterTag = season.ImageTags ? season.ImageTags.Primary : null;
                        var seasonPoster = seasonPosterTag
                            ? serverUrl + '/Items/' + season.Id + '/Images/Primary?maxHeight=350&quality=80'
                            : (item.ImageTags && item.ImageTags.Primary
                                ? serverUrl + '/Items/' + item.Id + '/Images/Primary?maxHeight=350&quality=80'
                                : '');
                        var seasonWatched = season.UserData && season.UserData.Played;
                        var seasonFavorite = season.UserData && season.UserData.IsFavorite;
                        var seasonUnplayed = season.UserData ? season.UserData.UnplayedItemCount : null;
                        return '<div class="moonfin-season-card moonfin-focusable" data-item-id="' + season.Id + '" data-type="Season" tabindex="0">' +
                            '<div class="moonfin-season-poster">' +
                                (seasonPoster ? '<img src="' + seasonPoster + '" alt="" loading="lazy">' : '<span>' + season.Name + '</span>') +
                                (seasonFavorite ? self.buildFavoriteIndicator() : '') +
                                (seasonWatched ? self.buildWatchedIndicator() :
                                (seasonUnplayed > 0 ? '<div class="moonfin-unplayed-count">' + seasonUnplayed + '</div>' : '')) +
                            '</div>' +
                            '<span class="moonfin-season-name">' + season.Name + '</span>' +
                        '</div>';
                    }).join('') +
                '</div>' +
            '</div>'
        ) : '';

        var episodesArr = episodes || [];
        var episodesHtml = '';
        if (isEpisode && episodesArr.length > 0) {
            var seasonLabel = item.ParentIndexNumber !== undefined ? 'Season ' + item.ParentIndexNumber + ' Episodes' : 'Episodes';
            var epCards = episodesArr.map(function(ep) {
                var epThumbTag = ep.ImageTags ? ep.ImageTags.Primary : null;
                var epThumbUrl = epThumbTag ? serverUrl + '/Items/' + ep.Id + '/Images/Primary?maxWidth=400&quality=80' : '';
                var isCurrentEp = ep.Id === item.Id;
                var epRuntime = ep.RunTimeTicks ? self.formatRuntime(ep.RunTimeTicks) : '';
                var epWatched = ep.UserData && ep.UserData.Played;
                var epFavorite = ep.UserData && ep.UserData.IsFavorite;
                return '<div class="moonfin-episode-card moonfin-focusable' + (isCurrentEp ? ' moonfin-episode-current' : '') + '" data-item-id="' + ep.Id + '" data-type="Episode" tabindex="0">' +
                    '<div class="moonfin-episode-thumb">' +
                        (epThumbUrl ? '<img src="' + epThumbUrl + '" alt="" loading="lazy">' : '<div class="moonfin-episode-thumb-placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9.5 7.5l7 4.5-7 4.5z"/></svg></div>') +
                        (epFavorite ? self.buildFavoriteIndicator() : '') +
                        (epWatched ? self.buildWatchedIndicator() : '') +
                        (ep.UserData && ep.UserData.PlayedPercentage ? '<div class="moonfin-episode-progress"><div class="moonfin-episode-progress-bar" style="width:' + Math.min(ep.UserData.PlayedPercentage, 100) + '%"></div></div>' : '') +
                    '</div>' +
                    '<div class="moonfin-episode-info">' +
                        '<span class="moonfin-episode-ep-number">E' + (ep.IndexNumber || '?') + '</span>' +
                        '<span class="moonfin-episode-ep-title">' + ep.Name + '</span>' +
                        (epRuntime ? '<span class="moonfin-episode-ep-runtime">' + epRuntime + '</span>' : '') +
                    '</div>' +
                '</div>';
            }).join('');

            episodesHtml = '<div class="moonfin-section">' +
                '<div class="moonfin-section-header">' +
                    '<h3 class="moonfin-section-title">' + seasonLabel + '</h3>' +
                    arrowsHtml +
                '</div>' +
                '<div class="moonfin-section-scroll">' + epCards + '</div>' +
            '</div>';
        }

        var chapters = item.Chapters || [];
        var chaptersHtml = chapters.length > 0 ? (
            '<div class="moonfin-section">' +
                '<div class="moonfin-section-header">' +
                    '<h3 class="moonfin-section-title">Chapters</h3>' +
                    arrowsHtml +
                '</div>' +
                '<div class="moonfin-section-scroll">' +
                    chapters.map(function(chapter, index) {
                        var chapterName = (chapter.Name && chapter.Name.trim()) ? chapter.Name : ('Chapter ' + (index + 1));
                        var startTicks = chapter.StartPositionTicks || 0;
                        var chapterTag = chapter.ImageTag ? '&tag=' + encodeURIComponent(chapter.ImageTag) : '';
                        var chapterImage = serverUrl + '/Items/' + item.Id + '/Images/Chapter/' + index + '?maxWidth=600&quality=80' + chapterTag;
                        var chapterStart = self.formatTimePosition(startTicks);

                        return '<div class="moonfin-chapter-card moonfin-focusable" data-start-ticks="' + startTicks + '" tabindex="0">' +
                            '<div class="moonfin-chapter-thumb">' +
                                '<img src="' + chapterImage + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'moonfin-chapter-thumb-empty\')">' +
                            '</div>' +
                            '<div class="moonfin-chapter-info">' +
                                '<span class="moonfin-chapter-title">' + chapterName + '</span>' +
                                '<span class="moonfin-chapter-time">' + chapterStart + '</span>' +
                            '</div>' +
                        '</div>';
                    }).join('') +
                '</div>' +
            '</div>'
        ) : '';

        var featureItems = features || [];
        var featuresHtml = featureItems.length > 0 ? (
            '<div class="moonfin-section">' +
                '<div class="moonfin-section-header">' +
                    '<h3 class="moonfin-section-title">Features</h3>' +
                    arrowsHtml +
                '</div>' +
                '<div class="moonfin-section-scroll">' +
                    featureItems.slice(0, 20).map(function(feature) {
                        var featurePosterTag = feature.ImageTags ? (feature.ImageTags.Primary || feature.ImageTags.Thumb) : null;
                        var featurePosterUrl = featurePosterTag ? serverUrl + '/Items/' + feature.Id + '/Images/Primary?maxHeight=400&quality=80' : '';
                        var featureWatched = feature.UserData && feature.UserData.Played;
                        var featureFavorite = feature.UserData && feature.UserData.IsFavorite;
                        return '<div class="moonfin-similar-card moonfin-focusable" data-item-id="' + feature.Id + '" data-type="' + (feature.Type || 'Video') + '" tabindex="0">' +
                            '<div class="moonfin-similar-poster">' +
                                (featurePosterUrl ? '<img src="' + featurePosterUrl + '" alt="" loading="lazy">' : '') +
                                (featureFavorite ? self.buildFavoriteIndicator() : '') +
                                (featureWatched ? self.buildWatchedIndicator() : '') +
                            '</div>' +
                            '<span class="moonfin-similar-title">' + (feature.Name || 'Feature') + '</span>' +
                        '</div>';
                    }).join('') +
                '</div>' +
            '</div>'
        ) : '';

        var collectionTitle = collections && collections.title ? collections.title : 'Collection';
        var collectionItems = collections && collections.items ? collections.items : [];
        var collectionsHtml = collectionItems.length > 0 ? (
            '<div class="moonfin-section">' +
                '<div class="moonfin-section-header">' +
                    '<h3 class="moonfin-section-title">' + collectionTitle + '</h3>' +
                    arrowsHtml +
                '</div>' +
                '<div class="moonfin-section-scroll">' +
                    collectionItems.slice(0, 30).map(function(col) {
                        var colPosterTag = col.ImageTags ? (col.ImageTags.Primary || col.ImageTags.Thumb) : null;
                        var colPosterUrl = colPosterTag ? serverUrl + '/Items/' + col.Id + '/Images/Primary?maxHeight=400&quality=80' : '';
                        var colWatched = col.UserData && col.UserData.Played;
                        return '<div class="moonfin-similar-card moonfin-focusable" data-item-id="' + col.Id + '" data-type="' + (col.Type || '') + '" tabindex="0">' +
                            '<div class="moonfin-similar-poster">' +
                                (colPosterUrl ? '<img src="' + colPosterUrl + '" alt="" loading="lazy">' : '') +
                                (colWatched ? '<div class="moonfin-watched-indicator"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z"/></svg></div>' : '') +
                            '</div>' +
                            '<span class="moonfin-similar-title">' + (col.Name || '') + '</span>' +
                        '</div>';
                    }).join('') +
                '</div>' +
            '</div>'
        ) : '';

        var backdrop = this.container.querySelector('.moonfin-details-backdrop');
        if (backdrop) {
            backdrop.style.backgroundImage = 'url(\'' + backdropUrl + '\')';
            backdrop.className = 'moonfin-details-backdrop';
        }

        panel.innerHTML = 
            '<button class="moonfin-details-back moonfin-focusable" title="Back" tabindex="0">' +
                '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>' +
            '</button>' +
            
            '<div class="moonfin-details-content">' +
                '<div class="moonfin-details-header">' +
                    '<div class="moonfin-info-section">' +
                        episodeHeader +
                        '<div class="moonfin-title-section">' +
                            (logoUrl ? '<img class="moonfin-logo" src="' + logoUrl + '" alt="' + item.Name + '">' : '<h1 class="moonfin-title">' + item.Name + '</h1>') +
                        '</div>' +
                        infoRowHtml +
                        '<div class="moonfin-mdblist-ratings-row" id="moonfin-details-mdblist"></div>' +
                        (tagline ? '<p class="moonfin-tagline">&ldquo;' + tagline + '&rdquo;</p>' : '') +
                        (item.Overview ? '<p class="moonfin-overview">' + item.Overview + '</p>' : '') +
                    '</div>' +
                    
                    '<div class="moonfin-poster-section' + (item.Type === 'Episode' ? ' moonfin-poster-landscape' : '') + '">' +
                        '<div class="moonfin-poster">' +
                            (posterUrl ? '<img src="' + posterUrl + '" alt="" loading="lazy">' : '') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                
                '<div class="moonfin-actions">' +
                    actionBtns.join('') +
                '</div>' +
                
                metadataHtml +
                
                '<div class="moonfin-sections">' +
                    collectionsHtml +
                    seasonsHtml +
                    episodesHtml +
                    chaptersHtml +
                    featuresHtml +
                    
                    (cast.length > 0 ? 
                        '<div class="moonfin-section">' +
                            '<div class="moonfin-section-header">' +
                                '<h3 class="moonfin-section-title">Cast & Crew</h3>' +
                                arrowsHtml +
                            '</div>' +
                            '<div class="moonfin-section-scroll">' + castHtml + '</div>' +
                        '</div>' : '') +
                    
                    (similar.length > 0 ? 
                        '<div class="moonfin-section">' +
                            '<div class="moonfin-section-header">' +
                                '<h3 class="moonfin-section-title">More Like This</h3>' +
                                arrowsHtml +
                            '</div>' +
                            '<div class="moonfin-section-scroll">' + similarHtml + '</div>' +
                        '</div>' : '') +
                '</div>' +
            '</div>';

        this.applyBackdropSettings();
        this.setupPanelListeners(panel, item);
    },

    getMediaBadges: function(item) {
        var badges = [];
        
        if (item.MediaStreams) {
            var video = null;
            var audio = null;
            
            for (var i = 0; i < item.MediaStreams.length; i++) {
                if (item.MediaStreams[i].Type === 'Video' && !video) video = item.MediaStreams[i];
                if (item.MediaStreams[i].Type === 'Audio' && !audio) audio = item.MediaStreams[i];
            }
            
            if (video) {
                if (video.Width >= 3800) badges.push('<span class="moonfin-badge moonfin-badge-4k">4K</span>');
                else if (video.Width >= 1900) badges.push('<span class="moonfin-badge moonfin-badge-hd">HD</span>');
                
                var hdrRangeTypes = ['HDR10', 'HDR10Plus', 'HLG', 'DOVI', 'DOVIWithHDR10', 'DOVIWithHDR10Plus', 'DOVIWithHLG', 'DOVIWithSDR'];
                if (video.VideoRange === 'HDR' || (video.VideoRangeType && hdrRangeTypes.indexOf(video.VideoRangeType) !== -1)) badges.push('<span class="moonfin-badge moonfin-badge-hdr">HDR</span>');
                
                if (video.VideoDoViTitle || (video.Title && video.Title.indexOf('Dolby Vision') !== -1)) {
                    badges.push('<span class="moonfin-badge moonfin-badge-dv">DV</span>');
                }

                var videoCodecLabel = this.getCodecBadgeLabel(video.Codec, 'Video');
                if (videoCodecLabel) {
                    badges.push('<span class="moonfin-badge moonfin-badge-codec">' + videoCodecLabel + '</span>');
                }
            }
            
            if (audio) {
                var audioCodecLabel = this.getCodecBadgeLabel(audio.Codec, 'Audio');
                if (audioCodecLabel) {
                    badges.push('<span class="moonfin-badge moonfin-badge-codec">' + audioCodecLabel + '</span>');
                }

                if ((audio.DisplayTitle && audio.DisplayTitle.indexOf('Atmos') !== -1) || (audio.Profile && audio.Profile.indexOf('Atmos') !== -1)) {
                    badges.push('<span class="moonfin-badge moonfin-badge-atmos">ATMOS</span>');
                } else if ((audio.DisplayTitle && audio.DisplayTitle.indexOf('DTS:X') !== -1) || (audio.Profile && audio.Profile.indexOf('DTS:X') !== -1)) {
                    badges.push('<span class="moonfin-badge moonfin-badge-dtsx">DTS:X</span>');
                } else if (audio.Channels >= 6) {
                    badges.push('<span class="moonfin-badge moonfin-badge-surround">' + (audio.Channels >= 8 ? '7.1' : '5.1') + '</span>');
                }
            }
        }
        
        return badges;
    },

    getCodecBadgeLabel: function(codec, streamType) {
        if (!codec) return '';

        var normalized = String(codec).toUpperCase();

        if (streamType === 'Video') {
            if (normalized === 'H264' || normalized === 'AVC') return 'H.264';
            if (normalized === 'H265' || normalized === 'HEVC') return 'HEVC';
        }

        if (streamType === 'Audio') {
            if (normalized === 'EAC3') return 'E-AC3';
            if (normalized === 'TRUEHD') return 'TRUEHD';
        }

        return normalized;
    },

    formatRuntime: function(ticks) {
        var minutes = Math.floor(ticks / 600000000);
        if (minutes < 60) return minutes + 'm';
        var hours = Math.floor(minutes / 60);
        var mins = minutes % 60;
        return mins > 0 ? hours + 'h ' + mins + 'm' : hours + 'h';
    },

    formatTimePosition: function(ticks) {
        var totalSeconds = Math.floor((ticks || 0) / 10000000);
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = totalSeconds % 60;

        var mm = minutes < 10 ? '0' + minutes : '' + minutes;
        var ss = seconds < 10 ? '0' + seconds : '' + seconds;
        if (hours > 0) {
            var hh = hours < 10 ? '0' + hours : '' + hours;
            return hh + ':' + mm + ':' + ss;
        }
        return mm + ':' + ss;
    },

    toggleFavorite: function(item) {
        var self = this;
        var api = API.getApiClient();
        var userId = api.getCurrentUserId();
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();
        var isFav = item.UserData ? item.UserData.IsFavorite : false;
        fetch(serverUrl + '/Users/' + userId + '/FavoriteItems/' + item.Id, {
            method: isFav ? 'DELETE' : 'POST',
            headers: headers
        }).then(function(resp) {
            if (resp.ok) {
                if (!item.UserData) item.UserData = {};
                item.UserData.IsFavorite = !isFav;
                var wrapper = self.container.querySelector('[data-action="favorite"]');
                if (wrapper) {
                    wrapper.classList.toggle('active');
                    var label = wrapper.querySelector('.moonfin-btn-label');
                    if (label) label.textContent = item.UserData.IsFavorite ? 'Favorited' : 'Favorite';
                }
                self.updateItemIndicators(item.Id);
            }
        }).catch(function(err) { console.error('[Moonfin] Details: Failed to toggle favorite', err); });
    },

    togglePlayed: function(item) {
        var self = this;
        var api = API.getApiClient();
        var userId = api.getCurrentUserId();
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();
        var isPlayed = item.UserData ? item.UserData.Played : false;
        fetch(serverUrl + '/Users/' + userId + '/PlayedItems/' + item.Id, {
            method: isPlayed ? 'DELETE' : 'POST',
            headers: headers
        }).then(function(resp) {
            if (resp.ok) {
                if (!item.UserData) item.UserData = {};
                item.UserData.Played = !isPlayed;
                var wrapper = self.container.querySelector('[data-action="played"]');
                if (wrapper) {
                    wrapper.classList.toggle('active');
                    var label = wrapper.querySelector('.moonfin-btn-label');
                    if (label) label.textContent = item.UserData.Played ? 'Watched' : 'Unwatched';
                }
                self.updateItemIndicators(item.Id);
            }
        }).catch(function(err) { console.error('[Moonfin] Details: Failed to toggle played', err); });
    },

    updateItemIndicators: function(itemId) {
        if (!itemId || !this.currentItem || this.currentItem.Id !== itemId) return;
        
        var self = this;
        var item = this.currentItem;
        
        var panel = this.container.querySelector('.moonfin-details-panel');
        if (panel) {
            panel.querySelectorAll('[data-item-id="' + itemId + '"]').forEach(function(card) {
                var posterDiv = card.querySelector('.moonfin-similar-poster') || 
                               card.querySelector('.moonfin-season-poster') || 
                               card.querySelector('.moonfin-episode-thumb') || 
                               card.querySelector('.moonfin-season-ep-thumb');
                if (!posterDiv) return;
                posterDiv.querySelectorAll('.moonfin-favorite-indicator, .moonfin-watched-indicator').forEach(function(el) { el.remove(); });
                if (item.UserData && item.UserData.IsFavorite) {
                    var fav = document.createElement('div');
                    fav.className = 'moonfin-favorite-indicator';
                    fav.innerHTML = self.FAVORITE_INDICATOR_SVG;
                    posterDiv.appendChild(fav);
                }
                if (item.UserData && item.UserData.Played) {
                    var watched = document.createElement('div');
                    watched.className = 'moonfin-watched-indicator';
                    watched.innerHTML = self.WATCHED_INDICATOR_SVG;
                    posterDiv.appendChild(watched);
                }
            });
        }
        
        var libraryOverlay = document.querySelector('.moonfin-library-overlay.visible');
        if (libraryOverlay) {
            libraryOverlay.querySelectorAll('[data-item-id="' + itemId + '"]').forEach(function(card) {
                var posterDiv = card.querySelector('.moonfin-genre-item-poster');
                if (!posterDiv) return;
                posterDiv.querySelectorAll('.moonfin-library-favorite-indicator, .moonfin-library-watched-indicator').forEach(function(el) { el.remove(); });
                if (item.UserData && item.UserData.IsFavorite) {
                    var fav = document.createElement('div');
                    fav.className = 'moonfin-library-favorite-indicator';
                    fav.setAttribute('data-item-id', itemId);
                    fav.innerHTML = self.FAVORITE_INDICATOR_SVG;
                    posterDiv.appendChild(fav);
                }
                if (item.UserData && item.UserData.Played) {
                    var watched = document.createElement('div');
                    watched.className = 'moonfin-library-watched-indicator';
                    watched.setAttribute('data-item-id', itemId);
                    watched.innerHTML = self.WATCHED_INDICATOR_SVG;
                    posterDiv.appendChild(watched);
                }
            });
        }
        
        document.querySelectorAll('.card[data-id="' + itemId + '"], .listItem[data-id="' + itemId + '"]').forEach(function(card) {
            var posterContainer = card.querySelector('.cardImageContainer') || card.querySelector('.listItemImageContainer');
            if (!posterContainer) return;
            posterContainer.querySelectorAll('.moonfin-library-favorite-indicator, .moonfin-library-watched-indicator').forEach(function(el) { el.remove(); });
            if (item.UserData && item.UserData.IsFavorite) {
                var fav = document.createElement('div');
                fav.className = 'moonfin-library-favorite-indicator';
                fav.innerHTML = self.FAVORITE_INDICATOR_SVG;
                posterContainer.appendChild(fav);
            }
            if (item.UserData && item.UserData.Played) {
                var watched = document.createElement('div');
                watched.className = 'moonfin-library-watched-indicator';
                watched.innerHTML = self.WATCHED_INDICATOR_SVG;
                posterContainer.appendChild(watched);
            }
        });
    },

    setupScrollArrows: function(panel) {
        var arrowBtns = panel.querySelectorAll('.moonfin-section-arrow');
        for (var m = 0; m < arrowBtns.length; m++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var section = btn.closest('.moonfin-section');
                    if (!section) return;
                    var scrollContainer = section.querySelector('.moonfin-section-scroll');
                    if (!scrollContainer) return;
                    var scrollAmount = scrollContainer.clientWidth * 0.7;
                    var isLeft = btn.classList.contains('moonfin-arrow-left');
                    scrollContainer.scrollBy({
                        left: isLeft ? -scrollAmount : scrollAmount,
                        behavior: 'smooth'
                    });
                });
            })(arrowBtns[m]);
        }
    },

    setupPanelListeners: function(panel, item) {
        var self = this;
        
        var backBtn = panel.querySelector('.moonfin-details-back');
        if (backBtn) backBtn.addEventListener('click', function() { self.hide(); });

        var actionBtns = panel.querySelectorAll('[data-action]');
        for (var i = 0; i < actionBtns.length; i++) {
            (function(btn) {
                btn.addEventListener('click', function(e) {
                    self.handleAction(e.currentTarget.getAttribute('data-action'), item);
                });
            })(actionBtns[i]);
        }

        var similarCards = panel.querySelectorAll('.moonfin-similar-card');
        for (var j = 0; j < similarCards.length; j++) {
            (function(card) {
                card.addEventListener('click', function() {
                    self.showDetails(card.getAttribute('data-item-id'), card.getAttribute('data-type'));
                });
            })(similarCards[j]);
        }

        var seasonCards = panel.querySelectorAll('.moonfin-season-card');
        for (var k = 0; k < seasonCards.length; k++) {
            (function(card) {
                card.addEventListener('click', function() {
                    self.showDetails(card.getAttribute('data-item-id'), 'Season');
                });
            })(seasonCards[k]);
        }

        var episodeCards = panel.querySelectorAll('.moonfin-episode-card');
        for (var n = 0; n < episodeCards.length; n++) {
            (function(card) {
                card.addEventListener('click', function() {
                    var epId = card.getAttribute('data-item-id');
                    self.showDetails(epId, 'Episode');
                });
            })(episodeCards[n]);
        }

        var chapterCards = panel.querySelectorAll('.moonfin-chapter-card');
        for (var o = 0; o < chapterCards.length; o++) {
            (function(card) {
                card.addEventListener('click', function() {
                    var startTicks = parseInt(card.getAttribute('data-start-ticks') || '0', 10);
                    if (isNaN(startTicks)) startTicks = 0;
                    self.hide(true);
                    self.playItem(item.Id, startTicks, self._selectedAudioIndex, self._selectedSubtitleIndex, self._selectedMediaSourceId);
                });
            })(chapterCards[o]);
        }

        var personCards = panel.querySelectorAll('.moonfin-cast-card');
        for (var l = 0; l < personCards.length; l++) {
            (function(card) {
                card.addEventListener('click', function() {
                    self.showDetails(card.getAttribute('data-person-id'), 'Person');
                });
            })(personCards[l]);
        }

        this.setupScrollArrows(panel);
    },

    getAuthHeaders: function() {
        var api = API.getApiClient();
        var token = api.accessToken();
        return {
            'Authorization': 'MediaBrowser Token="' + token + '"',
            'Content-Type': 'application/json'
        };
    },

    getServerUrl: function() {
        var api = API.getApiClient();
        return api._serverAddress || api.serverAddress();
    },

    getSessionId: function() {
        var api = API.getApiClient();
        var serverUrl = this.getServerUrl();
        var deviceId = api.deviceId();

        return fetch(serverUrl + '/Sessions?DeviceId=' + encodeURIComponent(deviceId), {
            headers: this.getAuthHeaders()
        }).then(function(resp) {
            return resp.json();
        }).then(function(sessions) {
            return (sessions && sessions.length > 0) ? sessions[0].Id : null;
        });
    },

    playItem: function(itemId, startPositionTicks, audioStreamIndex, subtitleStreamIndex, mediaSourceId) {
        var self = this;

        var pm = API.getPlaybackManager();
        if (pm) {
            var opts = {
                ids: [itemId],
                startPositionTicks: startPositionTicks || 0,
                serverId: API.getServerId()
            };
            if (mediaSourceId) opts.mediaSourceId = mediaSourceId;
            if (audioStreamIndex != null) opts.audioStreamIndex = audioStreamIndex;
            if (subtitleStreamIndex != null && subtitleStreamIndex !== -1) {
                opts.subtitleStreamIndex = subtitleStreamIndex;
            }
            try {
                pm.play(opts).catch(function(e) {
                    console.error('[Moonfin] Details: playback failed', e);
                });
            } catch(e) {
                console.error('[Moonfin] Details: playbackManager.play() failed', e);
                self._playViaSession(itemId, startPositionTicks, audioStreamIndex, subtitleStreamIndex, mediaSourceId);
            }
            return;
        }

        var api = API.getApiClient();
        if (api && typeof api.sendPlayCommand === 'function') {
            var deviceId = api.deviceId();
            api.getSessions({ DeviceId: deviceId }).then(function(sessions) {
                if (sessions && sessions.length > 0) {
                    return api.sendPlayCommand(sessions[0].Id, {
                        ItemIds: [itemId],
                        PlayCommand: 'PlayNow',
                        StartPositionTicks: startPositionTicks || 0,
                        MediaSourceId: mediaSourceId || undefined,
                        AudioStreamIndex: audioStreamIndex != null ? audioStreamIndex : undefined,
                        SubtitleStreamIndex: (subtitleStreamIndex != null && subtitleStreamIndex !== -1) ? subtitleStreamIndex : undefined
                    });
                }
                throw new Error('No session');
            }).catch(function() {
                self._playViaSession(itemId, startPositionTicks, audioStreamIndex, subtitleStreamIndex, mediaSourceId);
            });
            return;
        }

        self._playViaSession(itemId, startPositionTicks, audioStreamIndex, subtitleStreamIndex, mediaSourceId);
    },

    _playViaSession: function(itemId, startPositionTicks, audioStreamIndex, subtitleStreamIndex, mediaSourceId) {
        var self = this;
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();

        this.getSessionId().then(function(sessionId) {
            if (!sessionId) {
                throw new Error('No session found');
            }

            var params = 'PlayCommand=PlayNow&ItemIds=' + encodeURIComponent(itemId) +
                '&StartPositionTicks=' + (startPositionTicks || 0);
            if (mediaSourceId) params += '&MediaSourceId=' + encodeURIComponent(mediaSourceId);
            if (audioStreamIndex != null) params += '&AudioStreamIndex=' + audioStreamIndex;
            if (subtitleStreamIndex != null && subtitleStreamIndex !== -1) {
                params += '&SubtitleStreamIndex=' + subtitleStreamIndex;
            }

            return fetch(serverUrl + '/Sessions/' + sessionId + '/Playing?' + params, {
                method: 'POST',
                headers: headers
            }).then(function(resp) {
                if (!resp.ok) throw new Error('Play command failed: ' + resp.status);
            });
        }).catch(function(err) {
            console.error('[Moonfin] Details: Sessions API failed, using fallback', err);
            self._playViaFallback(itemId);
        });
    },

    // Fallback: navigate to native details page and auto-click play
    _playViaFallback: function(itemId) {
        API.navigateTo('/details?id=' + itemId);
        // Wait for the Jellyfin details page to load, then click its play button
        var attempts = 0;
        var tryClick = setInterval(function() {
            attempts++;
            var playBtn = document.querySelector('.btnPlay, .detailButton-primary, [data-action="resume"], [data-action="play"]');
            if (playBtn) {
                clearInterval(tryClick);
                playBtn.click();
            } else if (attempts > 20) {
                clearInterval(tryClick);
            }
        }, 250);
    },

    shuffleItem: function(itemId) {
        var self = this;
        var api = API.getApiClient();
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();
        var userId = api.getCurrentUserId();

        fetch(serverUrl + '/Shows/' + itemId + '/Episodes?UserId=' + userId + '&Fields=MediaSources', {
            headers: headers
        }).then(function(resp) {
            return resp.json();
        }).then(function(result) {
            var items = result.Items || [];
            if (items.length === 0) return;

            var ids = items.map(function(i) { return i.Id; });
            for (var i = ids.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = ids[i];
                ids[i] = ids[j];
                ids[j] = temp;
            }

            var pm = API.getPlaybackManager();
            if (pm) {
                try {
                    pm.play({ ids: ids, startPositionTicks: 0, serverId: API.getServerId() }).catch(function(e) {
                        console.error('[Moonfin] Details: shuffle playback failed', e);
                    });
                    return;
                } catch(e) {
                    console.error('[Moonfin] Details: playbackManager.play() failed for shuffle', e);
                }
            }

            if (typeof api.sendPlayCommand === 'function') {
                var deviceId = api.deviceId();
                return api.getSessions({ DeviceId: deviceId }).then(function(sessions) {
                    if (sessions && sessions.length > 0) {
                        return api.sendPlayCommand(sessions[0].Id, {
                            ItemIds: ids,
                            PlayCommand: 'PlayNow',
                            StartPositionTicks: 0
                        });
                    }
                    throw new Error('No session');
                }).catch(function() {
                    return self._shuffleViaSession(ids);
                });
            }

            return self._shuffleViaSession(ids);
        }).catch(function(err) {
            console.error('[Moonfin] Details: Failed to shuffle', err);
        });
    },

    _shuffleViaSession: function(ids) {
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();

        return this.getSessionId().then(function(sessionId) {
            if (!sessionId) return;

            var params = 'PlayCommand=PlayNow&ItemIds=' + encodeURIComponent(ids.join(',')) +
                '&StartPositionTicks=0';

            return fetch(serverUrl + '/Sessions/' + sessionId + '/Playing?' + params, {
                method: 'POST',
                headers: headers
            });
        });
    },

    playTrailer: function(item) {
        var self = this;
        this.resolveTrailerSource(item).then(function(source) {
            if (!source) {
                self.playLocalTrailer(item);
                return;
            }
            self.openTrailerOverlay(source, item.Name || 'Trailer');
        }).catch(function(err) {
            console.error('[Moonfin] Details: Failed to open trailer', err);
            self.playLocalTrailer(item);
        });
    },

    resolveTrailerSource: function(item) {
        var self = this;
        var existingUrl = this.getFirstTrailerUrl(item.RemoteTrailers);
        if (existingUrl) return Promise.resolve(this.buildTrailerSource(existingUrl));

        return API.getItemTrailers(item.Id).then(function(trailers) {
            item.RemoteTrailers = trailers || [];
            var url = self.getFirstTrailerUrl(item.RemoteTrailers);
            return url ? self.buildTrailerSource(url) : null;
        }).catch(function() {
            return null;
        });
    },

    buildTrailerSource: function(url) {
        var videoId = this.extractYouTubeIdFromUrl(url);
        if (videoId) {
            return { type: 'youtube', videoId: videoId };
        }
        return { type: 'iframe', url: url };
    },

    getFirstTrailerUrl: function(trailers) {
        if (!trailers || !trailers.length) return null;
        for (var i = 0; i < trailers.length; i++) {
            var trailer = trailers[i] || {};
            var url = trailer.Url || trailer.url;
            if (url) return url;
        }
        return null;
    },

    extractYouTubeIdFromUrl: function(url) {
        if (!url) return null;
        var match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        return match ? match[1] : null;
    },

    openTrailerOverlay: function(source, title) {
        var self = this;
        this.closeTrailerOverlay();

        var overlay = document.createElement('div');
        overlay.className = 'moonfin-trailer-overlay';
        overlay.innerHTML =
            '<div class="moonfin-trailer-modal" role="dialog" aria-modal="true" aria-label="' + (title || 'Trailer') + '">' +
                '<button class="moonfin-trailer-close moonfin-focusable" aria-label="Close trailer" tabindex="0">' +
                    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 5.71 12 12l6.3 6.29-1.41 1.42L10.59 13.4 4.29 19.71 2.88 18.3 9.17 12 2.88 5.71 4.29 4.29l6.3 6.3 6.29-6.3z"/></svg>' +
                '</button>' +
                '<div class="moonfin-trailer-player-host"></div>' +
            '</div>';

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                self.closeTrailerOverlay();
            }
        });

        var closeBtn = overlay.querySelector('.moonfin-trailer-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                self.closeTrailerOverlay();
            });
        }

        this._trailerEscHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault();
                e.stopPropagation();
                self.closeTrailerOverlay();
            }
        };

        this._trailerPreviousFocus = document.activeElement;
        this._trailerOverlay = overlay;
        document.addEventListener('keydown', this._trailerEscHandler, true);
        document.body.appendChild(overlay);

        this.loadTrailerOverlayPlayer(source);

        setTimeout(function() {
            if (closeBtn) closeBtn.focus();
        }, 0);
    },

    loadTrailerOverlayPlayer: function(source) {
        if (!this._trailerOverlay) return;

        var host = this._trailerOverlay.querySelector('.moonfin-trailer-player-host');
        if (!host) return;

        if (source.type === 'youtube' && source.videoId) {
            this._loadTrailerYouTubePlayer(host, source.videoId);
            return;
        }

        host.innerHTML =
            '<iframe class="moonfin-trailer-iframe visible" src="' + source.url + '" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen loading="eager" referrerpolicy="origin"></iframe>';
    },

    _ensureYTApi: function(callback) {
        if (window.YT && window.YT.Player) {
            callback();
            return;
        }

        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            var tag = document.createElement('script');
            tag.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(tag);
        }

        var checkInterval = setInterval(function() {
            if (window.YT && window.YT.Player) {
                clearInterval(checkInterval);
                callback();
            }
        }, 100);

        setTimeout(function() { clearInterval(checkInterval); }, 10000);
    },

    _loadTrailerYouTubePlayer: function(host, videoId) {
        var self = this;
        host.innerHTML = '<div class="moonfin-trailer-loading"><div class="moonfin-spinner"></div><span>Loading trailer...</span></div>';

        this._ensureYTApi(function() {
            if (!self._trailerOverlay) return;

            if (self._trailerPlayer) {
                try { self._trailerPlayer.destroy(); } catch(e) {}
                self._trailerPlayer = null;
            }

            var playerDiv = document.createElement('div');
            playerDiv.id = 'moonfin-details-yt-player-' + Date.now();
            playerDiv.className = 'moonfin-trailer-iframe';
            host.innerHTML = '';
            host.appendChild(playerDiv);

            try {
                self._trailerPlayer = new YT.Player(playerDiv.id, {
                    videoId: videoId,
                    playerVars: {
                        autoplay: 1,
                        controls: 1,
                        rel: 0,
                        modestbranding: 1,
                        playsinline: 1,
                        iv_load_policy: 3,
                        fs: 1,
                        origin: window.location.origin
                    },
                    events: {
                        onReady: function(event) {
                            event.target.playVideo();
                            var iframe = host.querySelector('iframe');
                            if (iframe) iframe.classList.add('visible');
                        },
                        onError: function(event) {
                            console.warn('[Moonfin] Details: YouTube player error:', event.data);
                            host.innerHTML = '<div class="moonfin-details-error"><span>Unable to load trailer</span></div>';
                        }
                    }
                });
            } catch(e) {
                console.warn('[Moonfin] Details: Failed to create YouTube player:', e);
                host.innerHTML = '<div class="moonfin-details-error"><span>Unable to load trailer</span></div>';
            }
        });
    },

    closeTrailerOverlay: function() {
        if (!this._trailerOverlay) return false;

        if (this._trailerEscHandler) {
            document.removeEventListener('keydown', this._trailerEscHandler, true);
            this._trailerEscHandler = null;
        }

        if (this._trailerPlayer) {
            try { this._trailerPlayer.destroy(); } catch(e) {}
            this._trailerPlayer = null;
        }

        var iframe = this._trailerOverlay.querySelector('.moonfin-trailer-iframe');
        if (iframe && iframe.tagName === 'IFRAME') iframe.src = 'about:blank';

        this._trailerOverlay.remove();
        this._trailerOverlay = null;

        if (this._trailerPreviousFocus && typeof this._trailerPreviousFocus.focus === 'function') {
            this._trailerPreviousFocus.focus();
        }
        this._trailerPreviousFocus = null;
        return true;
    },

    playLocalTrailer: function(item) {
        var self = this;
        if (!item.LocalTrailerCount || item.LocalTrailerCount <= 0) return;

        var api = API.getApiClient();
        var userId = api.getCurrentUserId();
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();

        fetch(serverUrl + '/Users/' + userId + '/Items/' + item.Id + '/LocalTrailers', {
            headers: headers
        }).then(function(resp) {
            return resp.json();
        }).then(function(trailers) {
            if (trailers && trailers.length > 0) {
                self.hide(true);
                self.playItem(trailers[0].Id, 0);
            }
        }).catch(function(err) {
            console.error('[Moonfin] Details: Failed to load local trailers', err);
        });
    },

    handleAction: function(action, item) {
        switch (action) {
            case 'play':
                this.hide(true);
                var resumeTicks = (item.UserData && item.UserData.PlaybackPositionTicks) ? item.UserData.PlaybackPositionTicks : 0;
                this.playItem(item.Id, resumeTicks, this._selectedAudioIndex, this._selectedSubtitleIndex, this._selectedMediaSourceId);
                break;

            case 'restart':
                this.hide(true);
                this.playItem(item.Id, 0, this._selectedAudioIndex, this._selectedSubtitleIndex, this._selectedMediaSourceId);
                break;

            case 'version':
                this.showVersionPicker(item);
                break;

            case 'audio':
                this.showAudioPicker(item);
                break;

            case 'subtitle':
                this.showSubtitlePicker(item);
                break;

            case 'trailer':
                this.playTrailer(item);
                break;

            case 'shuffle':
                this.hide(true);
                this.shuffleItem(item.Id);
                break;

            case 'favorite':
                this.toggleFavorite(item);
                break;

            case 'played':
                this.togglePlayed(item);
                break;

            case 'series':
                Details.showDetails(item.SeriesId, 'Series');
                break;

            case 'more':
                this.showMoreMenu(item);
                break;
        }
    },

    renderMdbListRatings: function(ratings) {
        var container = this.container.querySelector('#moonfin-details-mdblist');
        if (!container) return;

        var html = MdbList.buildRatingsHtml(ratings, 'full');
        if (html) {
            container.innerHTML = html;
            container.style.display = '';
        }
    },

    renderTmdbEpisodeRating: function(rating) {
        var container = this.container.querySelector('#moonfin-details-mdblist');
        if (!container) return;

        var html = Tmdb.buildRatingHtml(rating);
        if (html) {
            container.insertAdjacentHTML('beforeend', html);
            container.style.display = '';
        }
    },

    fetchTmdbRatingsForEpisodeList: function(item, episodes) {
        var self = this;
        if (!item.SeriesId) return;

        Tmdb.resolveSeriesTmdbId(item.SeriesId).then(function(tmdbId) {
            if (!tmdbId) return;
            var season = item.ParentIndexNumber;
            if (season == null) return;

            Tmdb.fetchSeasonRatings(tmdbId, season).then(function(tmdbEpisodes) {
                if (!tmdbEpisodes || tmdbEpisodes.length === 0) return;
                if (!self.currentItem || self.currentItem.Id !== item.Id) return;

                var ratingMap = {};
                for (var i = 0; i < tmdbEpisodes.length; i++) {
                    if (tmdbEpisodes[i].episodeNumber != null) {
                        ratingMap[tmdbEpisodes[i].episodeNumber] = tmdbEpisodes[i];
                    }
                }

                var epCards = self.container.querySelectorAll('.moonfin-episode-card');
                for (var j = 0; j < epCards.length; j++) {
                    var epId = epCards[j].getAttribute('data-item-id');
                    for (var k = 0; k < episodes.length; k++) {
                        if (episodes[k].Id === epId && episodes[k].IndexNumber != null) {
                            var tmdbRating = ratingMap[episodes[k].IndexNumber];
                            if (tmdbRating) {
                                var infoEl = epCards[j].querySelector('.moonfin-episode-info');
                                if (infoEl) {
                                    infoEl.insertAdjacentHTML('beforeend', Tmdb.buildCompactRatingHtml(tmdbRating));
                                }
                            }
                            break;
                        }
                    }
                }
            });
        });
    },

    showMoreMenu: function(item) {
        var self = this;

        this.closeMoreMenu();

        API.getCurrentUser().then(function(user) {
            self._buildMoreMenu(item, user);
        }).catch(function() {
            // Fallback: build with no user (only safe items shown)
            self._buildMoreMenu(item, null);
        });
    },

    _buildMoreMenu: function(item, user) {
        var self = this;
        var policy = (user && user.Policy) || {};
        var isAdmin = policy.IsAdministrator || false;

        var overlay = document.createElement('div');
        overlay.className = 'moonfin-more-overlay';

        var menuItems = [];

        // Add to Playlist — available for media items (has MediaType or IsFolder)
        if (item.MediaType || item.IsFolder) {
            menuItems.push({ id: 'addtoplaylist', name: 'Add to Playlist', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480-120v-80h280v80H480Zm0-160v-80h280v80H480Zm0-160v-80h280v80H480ZM200-360v-240h80v240h-80Zm120-120v-120h80v120h-80Z"/></svg>' });
        }

        // Add to Collection — admin or user with EnableCollectionManagement, and item supports it
        var collectionInvalidTypes = ['Genre', 'MusicGenre', 'Studio', 'UserView', 'CollectionFolder', 'Audio', 'Program', 'Timer', 'SeriesTimer'];
        if ((isAdmin || policy.EnableCollectionManagement) && !item.CollectionType && collectionInvalidTypes.indexOf(item.Type) === -1) {
            menuItems.push({ id: 'addtocollection', name: 'Add to Collection', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t121-71q17-91 90-147t163-56q100 0 172.5 69T707-554q71 5 122 57t51 127q0 75-52.5 127.5T700-190H260Zm0-80h440q42 0 71-29t29-71q0-42-29-71t-71-29h-60v-80q0-66-47-113t-113-47q-57 0-100 34t-56 89l-8 33h-42q-58 2-98 42.5T136-377q0 58 41 97.5t83 39.5Zm220-160Z"/></svg>' });
        }

        // Instant Mix — only for music-type items
        if (item.MediaType === 'Audio' || item.Type === 'MusicAlbum' || item.Type === 'MusicArtist' || item.Type === 'MusicGenre') {
            menuItems.push({ id: 'instantmix', name: 'Instant Mix', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-422h240v160H560v400q0 66-47 113t-113 47Z"/></svg>' });
        }

        // Media Info — only if MediaSources exist
        if (item.MediaSources) {
            menuItems.push({ id: 'mediainfo', name: 'Media Info', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M440-280h80v-240h-80v240Zm40-320q17 0 28.5-11.5T520-640q0-17-11.5-28.5T480-680q-17 0-28.5 11.5T440-640q0 17 11.5 28.5T480-600Zm0 520q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>' });
        }

        // Download — requires EnableContentDownloading permission and CanDownload on item
        if (policy.EnableContentDownloading && item.CanDownload) {
            menuItems.push({ id: 'download', name: 'Download', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z"/></svg>' });
        }

        // Delete — only if server says CanDelete is true
        if (item.CanDelete) {
            menuItems.push({ id: 'delete', name: 'Delete', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z"/></svg>', className: 'moonfin-more-item-danger' });
        }

        var hasAdminItems = false;

        // Edit Metadata — admin only
        if (isAdmin && item.Type !== 'Program' && item.Type !== 'Timer' && item.Type !== 'SeriesTimer') {
            hasAdminItems = true;
            menuItems.push({ id: 'editmetadata', name: 'Edit Metadata', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Zm640-584-56-56 56 56Zm-141 85-28-29 57 57-29-28Z"/></svg>' });
        }

        // Edit Images — admin only
        if (isAdmin && item.Type !== 'Timer' && item.Type !== 'SeriesTimer') {
            hasAdminItems = true;
            menuItems.push({ id: 'editimages', name: 'Edit Images', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm40-80h480L570-480 450-320l-90-120-120 160Zm-40 80v-560 560Z"/></svg>' });
        }

        // Edit Subtitles — admin or EnableSubtitleManagement, and Video media type
        if ((isAdmin || policy.EnableSubtitleManagement) && item.MediaType === 'Video') {
            hasAdminItems = true;
            menuItems.push({ id: 'editsubtitles', name: 'Edit Subtitles', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M200-160q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h560q33 0 56.5 23.5T840-720v480q0 33-23.5 56.5T760-160H200Zm0-80h560v-480H200v480Zm80-120h120v-80H280v80Zm200 0h200v-80H480v80ZM280-480h200v-80H280v80Zm280 0h120v-80H560v80Z"/></svg>' });
        }

        // Identify — admin only, specific item types
        var identifyTypes = ['Movie', 'Trailer', 'Series', 'BoxSet', 'Person', 'Book', 'MusicAlbum', 'MusicArtist', 'MusicVideo'];
        if (isAdmin && identifyTypes.indexOf(item.Type) !== -1) {
            hasAdminItems = true;
            menuItems.push({ id: 'identify', name: 'Identify', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M784-120 532-372q-30 24-69 38t-83 14q-109 0-184.5-75.5T120-580q0-109 75.5-184.5T380-840q109 0 184.5 75.5T640-580q0 44-14 83t-38 69l252 252-56 56ZM380-400q75 0 127.5-52.5T560-580q0-75-52.5-127.5T380-760q-75 0-127.5 52.5T200-580q0 75 52.5 127.5T380-400Z"/></svg>' });
        }

        // Refresh Metadata — admin only
        if (isAdmin) {
            hasAdminItems = true;
            menuItems.push({ id: 'refresh', name: 'Refresh Metadata', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/></svg>' });
        }

        // Open in Jellyfin — always available
        menuItems.push({ id: 'opennative', name: 'Open in Jellyfin', icon: '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h560v-280h80v280q0 33-23.5 56.5T760-120H200Zm188-212-56-56 372-372H560v-80h280v280h-80v-144L388-332Z"/></svg>' });

        var menuHtml = '<div class="moonfin-more-menu">' +
            '<h3 class="moonfin-more-title">' + (item.Name || 'Options') + '</h3>' +
            '<div class="moonfin-more-items">';

        for (var i = 0; i < menuItems.length; i++) {
            menuHtml += '<button class="moonfin-more-item moonfin-focusable' + (menuItems[i].className ? ' ' + menuItems[i].className : '') + '" data-more-action="' + menuItems[i].id + '" tabindex="0">' +
                '<span class="moonfin-more-item-icon">' + menuItems[i].icon + '</span>' +
                '<span class="moonfin-more-item-text">' + menuItems[i].name + '</span>' +
            '</button>';
        }

        menuHtml += '</div></div>';
        overlay.innerHTML = menuHtml;

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) self.closeMoreMenu();
        });

        overlay._escHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault();
                e.stopPropagation();
                self.closeMoreMenu();
            }
        };
        document.addEventListener('keydown', overlay._escHandler, true);

        var buttons = overlay.querySelectorAll('[data-more-action]');
        for (var j = 0; j < buttons.length; j++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var actionId = btn.getAttribute('data-more-action');
                    self.handleMoreAction(actionId, item);
                });
            })(buttons[j]);
        }

        document.body.appendChild(overlay);
        setTimeout(function() {
            var first = overlay.querySelector('.moonfin-more-item');
            if (first) first.focus();
        }, 50);
    },

    closeMoreMenu: function() {
        var existing = document.querySelector('.moonfin-more-overlay');
        if (existing) {
            if (existing._escHandler) {
                document.removeEventListener('keydown', existing._escHandler, true);
            }
            existing.remove();
        }
    },

    handleMoreAction: function(actionId, item) {
        var self = this;
        var api = API.getApiClient();
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();

        this.closeMoreMenu();

        switch (actionId) {
            case 'addtoplaylist':
                this.showPlaylistPicker(item);
                break;

            case 'addtocollection':
                this.showCollectionPicker(item);
                break;

            case 'mediainfo':
                this.showMediaInfo(item);
                break;

            case 'refresh':
                fetch(serverUrl + '/Items/' + item.Id + '/Refresh', {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({
                        Recursive: true,
                        MetadataRefreshMode: 'Default',
                        ImageRefreshMode: 'Default',
                        ReplaceAllMetadata: false,
                        ReplaceAllImages: false
                    })
                }).then(function() {
                    console.log('[Moonfin] Details: Metadata refresh queued');
                    self.showToast('Metadata refresh queued');
                }).catch(function(err) {
                    console.error('[Moonfin] Details: Failed to refresh metadata', err);
                });
                break;

            case 'instantmix':
                this.hide(true);
                var instantMixUrl = serverUrl + '/Items/' + item.Id + '/InstantMix?UserId=' + api.getCurrentUserId() + '&Limit=50';
                fetch(instantMixUrl, { headers: headers }).then(function(resp) {
                    return resp.json();
                }).then(function(result) {
                    var mixIds = (result.Items || []).map(function(i) { return i.Id; });
                    if (mixIds.length > 0) self.playItem(mixIds[0], 0);
                }).catch(function(err) {
                    console.error('[Moonfin] Details: Instant mix failed', err);
                });
                break;

            case 'download':
                var downloadUrl = serverUrl + '/Items/' + item.Id + '/Download?api_key=' + api.accessToken();
                var a = document.createElement('a');
                a.href = downloadUrl;
                a.download = item.Name || 'download';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                break;

            case 'editmetadata':
                self.hide(true);
                API.openMetadataEditor(item.Id).then(function(success) {
                    if (!success) API.navigateTo('/details?id=' + item.Id);
                });
                break;

            case 'editimages':
                self.hide(true);
                API.openImageEditor(item.Id).then(function(success) {
                    if (!success) API.navigateTo('/details?id=' + item.Id);
                });
                break;

            case 'editsubtitles':
                self.hide(true);
                API.openSubtitleEditor(item.Id).then(function(success) {
                    if (!success) API.navigateTo('/details?id=' + item.Id);
                });
                break;

            case 'identify':
                self.hide(true);
                API.openItemIdentifier(item.Id).then(function(success) {
                    if (!success) API.navigateTo('/details?id=' + item.Id);
                });
                break;

            case 'opennative':
                this.hide(true);
                API.navigateTo('/details?id=' + item.Id);
                break;

            case 'delete':
                self.confirmDelete(item);
                break;
        }
    },

    confirmDelete: function(item) {
        var self = this;
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();

        var overlay = document.createElement('div');
        overlay.className = 'moonfin-more-overlay';
        overlay.innerHTML = '<div class="moonfin-more-menu">' +
            '<h3 class="moonfin-more-title">Delete</h3>' +
            '<p style="color:rgba(255,255,255,0.7);margin:0 0 20px;text-align:center">Are you sure you want to delete<br><strong>' + (item.Name || 'this item') + '</strong>?<br><span style="color:#ff6b6b;font-size:13px">This action cannot be undone.</span></p>' +
            '<div style="display:flex;gap:12px;justify-content:center">' +
                '<button class="moonfin-more-item moonfin-focusable moonfin-delete-cancel" tabindex="0"><span class="moonfin-more-item-text">Cancel</span></button>' +
                '<button class="moonfin-more-item moonfin-focusable moonfin-more-item-danger moonfin-delete-confirm" tabindex="0"><span class="moonfin-more-item-text">Delete</span></button>' +
            '</div>' +
        '</div>';

        var closeOverlay = function() {
            if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
            overlay.remove();
        };

        overlay._escHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault();
                e.stopPropagation();
                closeOverlay();
            }
        };
        document.addEventListener('keydown', overlay._escHandler, true);
        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeOverlay(); });

        overlay.querySelector('.moonfin-delete-cancel').addEventListener('click', closeOverlay);
        overlay.querySelector('.moonfin-delete-confirm').addEventListener('click', function() {
            fetch(serverUrl + '/Items/' + item.Id, {
                method: 'DELETE',
                headers: headers
            }).then(function(resp) {
                if (resp.ok) {
                    self.showToast('Deleted successfully');
                    self.hide();
                } else {
                    self.showToast('Failed to delete - check permissions');
                }
                closeOverlay();
            }).catch(function(err) {
                console.error('[Moonfin] Details: Delete failed', err);
                self.showToast('Delete failed');
                closeOverlay();
            });
        });

        document.body.appendChild(overlay);
        setTimeout(function() { overlay.querySelector('.moonfin-delete-cancel').focus(); }, 50);
    },

    showToast: function(message) {
        var toast = document.createElement('div');
        toast.className = 'moonfin-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function() { toast.classList.add('visible'); }, 10);
        setTimeout(function() {
            toast.classList.remove('visible');
            setTimeout(function() { toast.remove(); }, 300);
        }, 2500);
    },

    _getSelectedMediaSource: function(item) {
        if (!item.MediaSources || !this._selectedMediaSourceId) return item.MediaSources ? item.MediaSources[0] : null;
        return item.MediaSources.find(function(s) { return s.Id === Details._selectedMediaSourceId; }) || item.MediaSources[0];
    },

    _getMediaStreams: function(item) {
        var source = this._getSelectedMediaSource(item);
        return source ? source.MediaStreams || item.MediaStreams || [] : item.MediaStreams || [];
    },

    showVersionPicker: function(item) {
        var self = this;
        if (!item.MediaSources || item.MediaSources.length < 2) return;

        var overlay = document.createElement('div');
        overlay.className = 'moonfin-more-overlay';

        var menuHtml = '<div class="moonfin-more-menu">' +
            '<h3 class="moonfin-more-title">Version</h3>' +
            '<div class="moonfin-more-items">';

        for (var i = 0; i < item.MediaSources.length; i++) {
            var src = item.MediaSources[i];
            var isSelected = src.Id === self._selectedMediaSourceId;
            menuHtml += '<button class="moonfin-more-item moonfin-focusable' + (isSelected ? ' active' : '') + '" data-source-id="' + src.Id + '" tabindex="0">' +
                '<span class="moonfin-more-item-icon"><svg viewBox="0 -960 960 960" fill="currentColor"><path d="M320-280h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-560v-160H240v640h480v-480H520ZM240-800v160-160 640-640Z"/></svg></span>' +
                '<span class="moonfin-more-item-text">' + (src.Name || ('Version ' + (i + 1))) + '</span>' +
            '</button>';
        }

        menuHtml += '</div></div>';
        overlay.innerHTML = menuHtml;

        var closeOverlay = function() {
            if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
            overlay.remove();
        };

        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeOverlay(); });
        overlay._escHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault(); e.stopPropagation(); closeOverlay();
            }
        };
        document.addEventListener('keydown', overlay._escHandler, true);

        var btns = overlay.querySelectorAll('[data-source-id]');
        for (var j = 0; j < btns.length; j++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var sourceId = btn.getAttribute('data-source-id');
                    self._selectedMediaSourceId = sourceId;

                    var versionBtn = self.container ? self.container.querySelector('[data-action="version"]') : null;
                    if (versionBtn) {
                        var label = versionBtn.querySelector('.moonfin-btn-label');
                        if (label) label.textContent = btn.querySelector('.moonfin-more-item-text').textContent;
                    }

                    var newSource = item.MediaSources.find(function(s) { return s.Id === sourceId; });
                    if (newSource) {
                        var streams = newSource.MediaStreams || [];
                        var audioTracks = streams.filter(function(s) { return s.Type === 'Audio'; });
                        var subtitleTracks = streams.filter(function(s) { return s.Type === 'Subtitle'; });

                        self._selectedAudioIndex = newSource.DefaultAudioStreamIndex != null ? newSource.DefaultAudioStreamIndex : null;
                        var audioBtn = self.container ? self.container.querySelector('[data-action="audio"]') : null;
                        if (audioBtn) {
                            if (audioTracks.length > 1) {
                                var audioTrack = audioTracks.find(function(t) { return t.Index === self._selectedAudioIndex; });
                                audioBtn.querySelector('.moonfin-btn-label').textContent = audioTrack ? (audioTrack.DisplayTitle || 'Audio') : 'Audio';
                                audioBtn.style.display = '';
                            } else {
                                audioBtn.style.display = 'none';
                                self._selectedAudioIndex = null;
                            }
                        }

                        self._selectedSubtitleIndex = newSource.DefaultSubtitleStreamIndex != null ? newSource.DefaultSubtitleStreamIndex : -1;
                        var subBtn = self.container ? self.container.querySelector('[data-action="subtitle"]') : null;
                        if (subBtn) {
                            if (subtitleTracks.length > 0) {
                                if (self._selectedSubtitleIndex === -1) {
                                    subBtn.querySelector('.moonfin-btn-label').textContent = 'Off';
                                } else {
                                    var subTrack = subtitleTracks.find(function(t) { return t.Index === self._selectedSubtitleIndex; });
                                    subBtn.querySelector('.moonfin-btn-label').textContent = subTrack ? (subTrack.DisplayTitle || 'Subtitles') : 'Subtitles';
                                }
                                subBtn.style.display = '';
                            } else {
                                subBtn.style.display = 'none';
                                self._selectedSubtitleIndex = -1;
                            }
                        }
                    }

                    closeOverlay();
                });
            })(btns[j]);
        }

        document.body.appendChild(overlay);
        setTimeout(function() {
            var first = overlay.querySelector('.moonfin-more-item');
            if (first) first.focus();
        }, 50);
    },

    showAudioPicker: function(item) {
        var self = this;
        var audioTracks = this._getMediaStreams(item).filter(function(s) { return s.Type === 'Audio'; });
        if (audioTracks.length < 2) return;

        var overlay = document.createElement('div');
        overlay.className = 'moonfin-more-overlay';

        var menuHtml = '<div class="moonfin-more-menu">' +
            '<h3 class="moonfin-more-title">Audio</h3>' +
            '<div class="moonfin-more-items">';

        for (var i = 0; i < audioTracks.length; i++) {
            var isSelected = audioTracks[i].Index === self._selectedAudioIndex;
            menuHtml += '<button class="moonfin-more-item moonfin-focusable' + (isSelected ? ' active' : '') + '" data-audio-index="' + audioTracks[i].Index + '" tabindex="0">' +
                '<span class="moonfin-more-item-icon"><svg viewBox="0 -960 960 960" fill="currentColor"><path d="M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-422h240v160H560v400q0 66-47 113t-113 47Z"/></svg></span>' +
                '<span class="moonfin-more-item-text">' + (audioTracks[i].DisplayTitle || ('Audio ' + (i + 1))) + '</span>' +
            '</button>';
        }

        menuHtml += '</div></div>';
        overlay.innerHTML = menuHtml;

        var closeOverlay = function() {
            if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
            overlay.remove();
        };

        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeOverlay(); });
        overlay._escHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault(); e.stopPropagation(); closeOverlay();
            }
        };
        document.addEventListener('keydown', overlay._escHandler, true);

        var btns = overlay.querySelectorAll('[data-audio-index]');
        for (var j = 0; j < btns.length; j++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    self._selectedAudioIndex = parseInt(btn.getAttribute('data-audio-index'), 10);
                    var audioBtn = self.container ? self.container.querySelector('[data-action="audio"]') : null;
                    if (audioBtn) {
                        var label = audioBtn.querySelector('.moonfin-btn-label');
                        if (label) label.textContent = btn.querySelector('.moonfin-more-item-text').textContent;
                    }
                    closeOverlay();
                });
            })(btns[j]);
        }

        document.body.appendChild(overlay);
        setTimeout(function() {
            var first = overlay.querySelector('.moonfin-more-item');
            if (first) first.focus();
        }, 50);
    },

    showSubtitlePicker: function(item) {
        var self = this;
        var subtitleTracks = this._getMediaStreams(item).filter(function(s) { return s.Type === 'Subtitle'; });
        if (subtitleTracks.length === 0) return;

        var overlay = document.createElement('div');
        overlay.className = 'moonfin-more-overlay';

        var menuHtml = '<div class="moonfin-more-menu">' +
            '<h3 class="moonfin-more-title">Subtitles</h3>' +
            '<div class="moonfin-more-items">';

        var offSelected = self._selectedSubtitleIndex === -1 || self._selectedSubtitleIndex == null;
        menuHtml += '<button class="moonfin-more-item moonfin-focusable' + (offSelected ? ' active' : '') + '" data-sub-index="-1" tabindex="0">' +
            '<span class="moonfin-more-item-text">Off</span>' +
        '</button>';

        for (var i = 0; i < subtitleTracks.length; i++) {
            var isSelected = subtitleTracks[i].Index === self._selectedSubtitleIndex;
            menuHtml += '<button class="moonfin-more-item moonfin-focusable' + (isSelected ? ' active' : '') + '" data-sub-index="' + subtitleTracks[i].Index + '" tabindex="0">' +
                '<span class="moonfin-more-item-icon"><svg viewBox="0 -960 960 960" fill="currentColor"><path d="M200-160q-33 0-56.5-23.5T120-240v-480q0-33 23.5-56.5T200-800h560q33 0 56.5 23.5T840-720v480q0 33-23.5 56.5T760-160H200Zm0-80h560v-480H200v480Zm80-120h120q17 0 28.5-11.5T440-400v-40h-60v20h-80v-120h80v20h60v-40q0-17-11.5-28.5T400-600H280q-17 0-28.5 11.5T240-560v160q0 17 11.5 28.5T280-360Zm280 0h120q17 0 28.5-11.5T720-400v-40h-60v20h-80v-120h80v20h60v-40q0-17-11.5-28.5T680-600H560q-17 0-28.5 11.5T520-560v160q0 17 11.5 28.5T560-360ZM200-240v-480 480Z\"/></svg></span>' +
                '<span class="moonfin-more-item-text">' + (subtitleTracks[i].DisplayTitle || ('Subtitle ' + (i + 1))) + '</span>' +
            '</button>';
        }

        menuHtml += '</div></div>';
        overlay.innerHTML = menuHtml;

        var closeOverlay = function() {
            if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
            overlay.remove();
        };

        overlay.addEventListener('click', function(e) { if (e.target === overlay) closeOverlay(); });
        overlay._escHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault(); e.stopPropagation(); closeOverlay();
            }
        };
        document.addEventListener('keydown', overlay._escHandler, true);

        var btns = overlay.querySelectorAll('[data-sub-index]');
        for (var j = 0; j < btns.length; j++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    self._selectedSubtitleIndex = parseInt(btn.getAttribute('data-sub-index'), 10);
                    var subBtn = self.container ? self.container.querySelector('[data-action="subtitle"]') : null;
                    if (subBtn) {
                        var label = subBtn.querySelector('.moonfin-btn-label');
                        if (label) {
                            var text = btn.querySelector('.moonfin-more-item-text').textContent;
                            label.textContent = text;
                        }
                    }
                    closeOverlay();
                });
            })(btns[j]);
        }

        document.body.appendChild(overlay);
        setTimeout(function() {
            var first = overlay.querySelector('.moonfin-more-item');
            if (first) first.focus();
        }, 50);
    },

    showPlaylistPicker: function(item) {
        var self = this;
        var api = API.getApiClient();
        var userId = api.getCurrentUserId();
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();

        fetch(serverUrl + '/Users/' + userId + '/Items?IncludeItemTypes=Playlist&Recursive=true&SortBy=SortName&SortOrder=Ascending', {
            headers: headers
        }).then(function(resp) {
            return resp.json();
        }).then(function(result) {
            var playlists = result.Items || [];

            var overlay = document.createElement('div');
            overlay.className = 'moonfin-more-overlay';

            var menuHtml = '<div class="moonfin-more-menu">' +
                '<h3 class="moonfin-more-title">Add to Playlist</h3>' +
                '<div class="moonfin-more-items">';

            menuHtml += '<button class="moonfin-more-item moonfin-focusable moonfin-playlist-create" tabindex="0">' +
                '<span class="moonfin-more-item-icon"><svg viewBox="0 -960 960 960" fill="currentColor"><path d="M440-440H200v-80h240v-240h80v240h240v80H520v240h-80v-240Z"/></svg></span>' +
                '<span class="moonfin-more-item-text">New Playlist</span>' +
            '</button>';

            if (playlists.length > 0) {
                menuHtml += '<div style="border-top:1px solid rgba(255,255,255,0.1);margin:4px 0"></div>';
            }

            for (var i = 0; i < playlists.length; i++) {
                menuHtml += '<button class="moonfin-more-item moonfin-focusable" data-playlist-id="' + playlists[i].Id + '" tabindex="0">' +
                    '<span class="moonfin-more-item-icon"><svg viewBox="0 -960 960 960" fill="currentColor"><path d="M500-360q42 0 71-29t29-71q0-42-29-71t-71-29q-42 0-71 29t-29 71q0 42 29 71t71 29ZM200-120v-640h560v361q-20-2-40 1t-40 12V-680H280v368l220-140 64 41q-13 17-20.5 37T536-334l-36 22-300-190v382Z"/></svg></span>' +
                    '<span class="moonfin-more-item-text">' + playlists[i].Name + '</span>' +
                '</button>';
            }

            menuHtml += '</div></div>';
            overlay.innerHTML = menuHtml;

            var closeOverlay = function() {
                if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
                overlay.remove();
            };

            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) closeOverlay();
            });

            overlay._escHandler = function(e) {
                if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                    e.preventDefault();
                    e.stopPropagation();
                    closeOverlay();
                }
            };
            document.addEventListener('keydown', overlay._escHandler, true);

            var createBtn = overlay.querySelector('.moonfin-playlist-create');
            if (createBtn) {
                createBtn.addEventListener('click', function() {
                    closeOverlay();
                    self.showCreatePlaylistDialog(item);
                });
            }

            var playlistBtns = overlay.querySelectorAll('[data-playlist-id]');
            for (var j = 0; j < playlistBtns.length; j++) {
                (function(btn) {
                    btn.addEventListener('click', function() {
                        var playlistId = btn.getAttribute('data-playlist-id');
                        fetch(serverUrl + '/Playlists/' + playlistId + '/Items?Ids=' + item.Id + '&UserId=' + userId, {
                            method: 'POST',
                            headers: headers
                        }).then(function() {
                            self.showToast('Added to playlist');
                        }).catch(function(err) {
                            console.error('[Moonfin] Details: Failed to add to playlist', err);
                            self.showToast('Failed to add to playlist');
                        });
                        if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
                        overlay.remove();
                    });
                })(playlistBtns[j]);
            }

            document.body.appendChild(overlay);
            setTimeout(function() {
                var first = overlay.querySelector('.moonfin-more-item');
                if (first) first.focus();
            }, 50);
        }).catch(function(err) {
            console.error('[Moonfin] Details: Failed to fetch playlists', err);
            self.showToast('Failed to load playlists');
        });
    },

    showCreatePlaylistDialog: function(item) {
        var self = this;
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();
        var api = API.getApiClient();
        var userId = api.getCurrentUserId();

        var overlay = document.createElement('div');
        overlay.className = 'moonfin-more-overlay';
        overlay.innerHTML = '<div class="moonfin-more-menu">' +
            '<h3 class="moonfin-more-title">New Playlist</h3>' +
            '<div style="padding:0 8px">' +
                '<input type="text" class="moonfin-playlist-name-input" placeholder="Playlist name" style="' +
                    'width:100%;box-sizing:border-box;padding:10px 14px;margin:8px 0 16px;' +
                    'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;' +
                    'color:#fff;font-size:15px;outline:none;font-family:inherit' +
                '" />' +
                '<div style="display:flex;gap:12px;justify-content:flex-end">' +
                    '<button class="moonfin-more-item moonfin-focusable moonfin-playlist-cancel" tabindex="0" style="flex:none;width:auto;padding:8px 20px">' +
                        '<span class="moonfin-more-item-text">Cancel</span>' +
                    '</button>' +
                    '<button class="moonfin-more-item moonfin-focusable moonfin-playlist-confirm" tabindex="0" style="flex:none;width:auto;padding:8px 20px">' +
                        '<span class="moonfin-more-item-text">Create</span>' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';

        var closeOverlay = function() {
            if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
            overlay.remove();
        };

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeOverlay();
        });

        overlay._escHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault();
                e.stopPropagation();
                closeOverlay();
            }
        };
        document.addEventListener('keydown', overlay._escHandler, true);

        overlay.querySelector('.moonfin-playlist-cancel').addEventListener('click', closeOverlay);

        overlay.querySelector('.moonfin-playlist-confirm').addEventListener('click', function() {
            var nameInput = overlay.querySelector('.moonfin-playlist-name-input');
            var playlistName = (nameInput.value || '').trim();
            if (!playlistName) {
                nameInput.style.borderColor = '#ff6b6b';
                nameInput.focus();
                return;
            }

            var mediaType = item.MediaType || 'Video';
            var createHeaders = Object.assign({}, headers, { 'Content-Type': 'application/json' });

            fetch(serverUrl + '/Playlists', {
                method: 'POST',
                headers: createHeaders,
                body: JSON.stringify({
                    Name: playlistName,
                    Ids: [item.Id],
                    UserId: userId,
                    MediaType: mediaType
                })
            }).then(function(resp) {
                if (!resp.ok) throw new Error('HTTP ' + resp.status);
                return resp.json();
            }).then(function() {
                self.showToast('Created playlist & added item');
                closeOverlay();
            }).catch(function(err) {
                console.error('[Moonfin] Details: Failed to create playlist', err);
                self.showToast('Failed to create playlist');
            });
        });

        var nameInput = overlay.querySelector('.moonfin-playlist-name-input');
        nameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                overlay.querySelector('.moonfin-playlist-confirm').click();
            }
        });

        document.body.appendChild(overlay);
        setTimeout(function() { nameInput.focus(); }, 50);
    },

    showCollectionPicker: function(item) {
        var self = this;
        var api = API.getApiClient();
        var userId = api.getCurrentUserId();
        var serverUrl = this.getServerUrl();
        var headers = this.getAuthHeaders();

        fetch(serverUrl + '/Users/' + userId + '/Items?IncludeItemTypes=BoxSet&Recursive=true&SortBy=SortName&SortOrder=Ascending', {
            headers: headers
        }).then(function(resp) {
            return resp.json();
        }).then(function(result) {
            var collections = result.Items || [];
            if (collections.length === 0) {
                self.showToast('No collections found');
                return;
            }

            var overlay = document.createElement('div');
            overlay.className = 'moonfin-more-overlay';

            var menuHtml = '<div class="moonfin-more-menu">' +
                '<h3 class="moonfin-more-title">Add to Collection</h3>' +
                '<div class="moonfin-more-items">';

            for (var i = 0; i < collections.length; i++) {
                menuHtml += '<button class="moonfin-more-item moonfin-focusable" data-collection-id="' + collections[i].Id + '" tabindex="0">' +
                    '<span class="moonfin-more-item-icon"><svg viewBox="0 -960 960 960" fill="currentColor"><path d="M260-160q-91 0-155.5-63T40-377q0-78 47-139t121-71q17-91 90-147t163-56q100 0 172.5 69T707-554q71 5 122 57t51 127q0 75-52.5 127.5T700-190H260Z"/></svg></span>' +
                    '<span class="moonfin-more-item-text">' + collections[i].Name + '</span>' +
                '</button>';
            }

            menuHtml += '</div></div>';
            overlay.innerHTML = menuHtml;

            overlay.addEventListener('click', function(e) {
                if (e.target === overlay) {
                    if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
                    overlay.remove();
                }
            });

            overlay._escHandler = function(e) {
                if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                    e.preventDefault();
                    e.stopPropagation();
                    document.removeEventListener('keydown', overlay._escHandler, true);
                    overlay.remove();
                }
            };
            document.addEventListener('keydown', overlay._escHandler, true);

            var collBtns = overlay.querySelectorAll('[data-collection-id]');
            for (var j = 0; j < collBtns.length; j++) {
                (function(btn) {
                    btn.addEventListener('click', function() {
                        var collectionId = btn.getAttribute('data-collection-id');
                        fetch(serverUrl + '/Collections/' + collectionId + '/Items?Ids=' + item.Id, {
                            method: 'POST',
                            headers: headers
                        }).then(function() {
                            self.showToast('Added to collection');
                        }).catch(function(err) {
                            console.error('[Moonfin] Details: Failed to add to collection', err);
                            self.showToast('Failed to add to collection');
                        });
                        if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
                        overlay.remove();
                    });
                })(collBtns[j]);
            }

            document.body.appendChild(overlay);
            setTimeout(function() {
                var first = overlay.querySelector('.moonfin-more-item');
                if (first) first.focus();
            }, 50);
        }).catch(function(err) {
            console.error('[Moonfin] Details: Failed to fetch collections', err);
            self.showToast('Failed to load collections');
        });
    },

    showMediaInfo: function(item) {
        var self = this;
        var streams = item.MediaStreams || [];

        var overlay = document.createElement('div');
        overlay.className = 'moonfin-more-overlay';

        var infoHtml = '<div class="moonfin-more-menu moonfin-media-info-menu">' +
            '<h3 class="moonfin-more-title">Media Info</h3>' +
            '<div class="moonfin-media-info-content">';

        if (streams.length === 0) {
            infoHtml += '<p class="moonfin-media-info-empty">No media info available</p>';
        } else {
            for (var i = 0; i < streams.length; i++) {
                var s = streams[i];
                infoHtml += '<div class="moonfin-media-info-stream">';
                infoHtml += '<div class="moonfin-media-info-stream-header">' + s.Type + (s.Language ? ' (' + s.Language + ')' : '') + '</div>';

                if (s.Type === 'Video') {
                    if (s.DisplayTitle) infoHtml += '<div class="moonfin-media-info-row">' + s.DisplayTitle + '</div>';
                    var details = [];
                    if (s.Width && s.Height) details.push(s.Width + 'x' + s.Height);
                    if (s.Codec) details.push(s.Codec.toUpperCase());
                    if (s.BitRate) details.push(Math.round(s.BitRate / 1000000) + ' Mbps');
                    if (s.VideoRange) details.push(s.VideoRange);
                    if (details.length) infoHtml += '<div class="moonfin-media-info-row">' + details.join(' · ') + '</div>';
                } else if (s.Type === 'Audio') {
                    if (s.DisplayTitle) infoHtml += '<div class="moonfin-media-info-row">' + s.DisplayTitle + '</div>';
                    var aDetails = [];
                    if (s.Codec) aDetails.push(s.Codec.toUpperCase());
                    if (s.Channels) aDetails.push(s.Channels + ' ch');
                    if (s.SampleRate) aDetails.push(s.SampleRate + ' Hz');
                    if (s.BitRate) aDetails.push(Math.round(s.BitRate / 1000) + ' kbps');
                    if (aDetails.length) infoHtml += '<div class="moonfin-media-info-row">' + aDetails.join(' · ') + '</div>';
                } else if (s.Type === 'Subtitle') {
                    var subDetails = [];
                    if (s.DisplayTitle) subDetails.push(s.DisplayTitle);
                    else if (s.Title) subDetails.push(s.Title);
                    if (s.Codec) subDetails.push(s.Codec.toUpperCase());
                    if (subDetails.length) infoHtml += '<div class="moonfin-media-info-row">' + subDetails.join(' · ') + '</div>';
                }

                infoHtml += '</div>';
            }

            if (item.Container) {
                infoHtml += '<div class="moonfin-media-info-stream">';
                infoHtml += '<div class="moonfin-media-info-stream-header">Container</div>';
                infoHtml += '<div class="moonfin-media-info-row">' + item.Container.toUpperCase() + '</div>';
                infoHtml += '</div>';
            }
        }

        infoHtml += '</div>' +
            '<button class="moonfin-more-item moonfin-focusable moonfin-media-info-close" tabindex="0">' +
                '<span class="moonfin-more-item-text">Close</span>' +
            '</button>' +
        '</div>';

        overlay.innerHTML = infoHtml;

        var closeMenu = function() {
            if (overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler, true);
            overlay.remove();
        };

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) closeMenu();
        });

        overlay._escHandler = function(e) {
            if (e.key === 'Escape' || e.keyCode === 27 || e.keyCode === 461 || e.keyCode === 10009) {
                e.preventDefault();
                e.stopPropagation();
                closeMenu();
            }
        };
        document.addEventListener('keydown', overlay._escHandler, true);

        var closeBtn = overlay.querySelector('.moonfin-media-info-close');
        if (closeBtn) closeBtn.addEventListener('click', closeMenu);

        document.body.appendChild(overlay);
        setTimeout(function() {
            if (closeBtn) closeBtn.focus();
        }, 50);
    },

    renderSeasonDetails: function(item, episodes) {
        var self = this;
        var panel = this.container.querySelector('.moonfin-details-panel');
        var api = API.getApiClient();
        var serverUrl = api._serverAddress;

        var backdropId = item.ParentBackdropItemId || item.Id;
        var backdropUrl = serverUrl + '/Items/' + backdropId + '/Images/Backdrop?maxWidth=1920&quality=90';

        var posterTag = item.ImageTags ? item.ImageTags.Primary : null;
        var posterUrl = posterTag
            ? serverUrl + '/Items/' + item.Id + '/Images/Primary?maxHeight=500&quality=90'
            : (item.SeriesId && item.SeriesPrimaryImageTag
                ? serverUrl + '/Items/' + item.SeriesId + '/Images/Primary?maxHeight=500&quality=90'
                : '');

        var isPlayed = item.UserData && item.UserData.Played;
        var isFavorite = item.UserData && item.UserData.IsFavorite;

        var firstUnwatched = null;
        for (var e = 0; e < episodes.length; e++) {
            if (!episodes[e].UserData || !episodes[e].UserData.Played) {
                firstUnwatched = episodes[e];
                break;
            }
        }

        var seasonActions = '';
        if (episodes.length > 0) {
            seasonActions += '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="play" tabindex="0">' +
                '<div class="moonfin-btn-circle moonfin-btn-primary">' +
                    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
                '</div>' +
                '<span class="moonfin-btn-label">Play</span>' +
            '</div>';

            seasonActions += '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="shuffle" tabindex="0">' +
                '<div class="moonfin-btn-circle">' +
                    '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M560-160v-80h104L537-367l57-57 126 126v-102h80v240H560Zm-344 0-56-56 504-504H560v-80h240v240h-80v-104L216-160Zm151-377L160-744l56-56 207 207-56 56Z"/></svg>' +
                '</div>' +
                '<span class="moonfin-btn-label">Shuffle</span>' +
            '</div>';
        }

        seasonActions += '<div class="moonfin-btn-wrapper moonfin-focusable ' + (isPlayed ? 'active' : '') + '" data-action="played" tabindex="0">' +
            '<div class="moonfin-btn-circle">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z"/></svg>' +
            '</div>' +
            '<span class="moonfin-btn-label">' + (isPlayed ? 'Watched' : 'Unwatched') + '</span>' +
        '</div>';

        seasonActions += '<div class="moonfin-btn-wrapper moonfin-focusable ' + (isFavorite ? 'active' : '') + '" data-action="favorite" tabindex="0">' +
            '<div class="moonfin-btn-circle">' +
                '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="' + (isFavorite ?
                    'm480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z' :
                    'M480-120q-14 0-28.5-5T426-140q-43-38-97.5-82.5T232-308q-41.5-41.5-72-83T122-475q-8-32-11-60.5T108-596q0-86 57-147t147-61q52 0 99 22t69 62q22-40 69-62t99-22q90 0 147 61t57 147q0 32-3 60.5T837-475q-7 42-37.5 83.5T728-308q-42 42-96.5 86.5T534-140q-11 10-25.5 15t-28.5 5Zm0-80q41-37 88.5-75t83-68.5q35.5-30.5 61-58T746-456q9-27 11.5-49t2.5-43q0-53-34.5-91.5T636-678q-43 0-77.5 24T507-602h-54q-17-28-51.5-52T324-678q-55 0-89.5 38.5T200-548q0 21 2.5 43t11.5 49q9 27 34.5 54.5t61 58Q345-313 392.5-275T480-200Z') +
                '"/></svg>' +
            '</div>' +
            '<span class="moonfin-btn-label">' + (isFavorite ? 'Favorited' : 'Favorite') + '</span>' +
        '</div>';

        seasonActions += '<div class="moonfin-btn-wrapper moonfin-focusable" data-action="more" tabindex="0">' +
            '<div class="moonfin-btn-circle">' +
                '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>' +
            '</div>' +
            '<span class="moonfin-btn-label">More</span>' +
        '</div>';

        var episodeListHtml = episodes.map(function(ep) {
            var epThumbTag = ep.ImageTags ? ep.ImageTags.Primary : null;
            var epThumbUrl = epThumbTag ? serverUrl + '/Items/' + ep.Id + '/Images/Primary?maxWidth=400&quality=80' : '';
            var epRuntime = ep.RunTimeTicks ? self.formatRuntime(ep.RunTimeTicks) : '';
            var epProgress = ep.UserData ? ep.UserData.PlayedPercentage : 0;
            var isPlayed = ep.UserData && ep.UserData.Played;
            var isFavorite = ep.UserData && ep.UserData.IsFavorite;

            return '<div class="moonfin-season-ep moonfin-focusable" data-item-id="' + ep.Id + '" data-type="Episode" tabindex="0">' +
                '<div class="moonfin-season-ep-thumb">' +
                    (epThumbUrl ? '<img src="' + epThumbUrl + '" alt="" loading="lazy">' : '<div class="moonfin-season-ep-thumb-placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9.5 7.5l7 4.5-7 4.5z"/></svg></div>') +
                    (isFavorite ? self.buildFavoriteIndicator() : '') +
                    (isPlayed ? self.buildWatchedIndicator() : '') +
                    (epProgress ? '<div class="moonfin-episode-progress"><div class="moonfin-episode-progress-bar" style="width:' + Math.min(epProgress, 100) + '%"></div></div>' : '') +
                '</div>' +
                '<div class="moonfin-season-ep-body">' +
                    '<div class="moonfin-season-ep-top">' +
                        '<span class="moonfin-season-ep-number">Episode ' + (ep.IndexNumber || '?') + '</span>' +
                        '<span class="moonfin-season-ep-meta">' +
                            (epRuntime ? '<span>' + epRuntime + '</span>' : '') +
                            (isPlayed ? '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16" class="moonfin-season-ep-check"><path d="M21 7L9 19l-5.5-5.5 1.41-1.41L9 16.17 19.59 5.59 21 7z"/></svg>' : '') +
                        '</span>' +
                    '</div>' +
                    '<span class="moonfin-season-ep-title">' + ep.Name + '</span>' +
                    (ep.Overview ? '<p class="moonfin-season-ep-overview">' + ep.Overview + '</p>' : '') +
                '</div>' +
            '</div>';
        }).join('');

        var backdrop = this.container.querySelector('.moonfin-details-backdrop');
        if (backdrop) {
            backdrop.style.backgroundImage = 'url(\'' + backdropUrl + '\')';
            backdrop.className = 'moonfin-details-backdrop';
        }

        panel.innerHTML =
            '<button class="moonfin-details-back moonfin-focusable" title="Back" tabindex="0">' +
                '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>' +
            '</button>' +

            '<div class="moonfin-details-content">' +
                '<div class="moonfin-season-detail-header">' +
                    '<div class="moonfin-season-detail-poster">' +
                        (posterUrl ? '<img src="' + posterUrl + '" alt="">' : '') +
                    '</div>' +
                    '<div class="moonfin-season-detail-info">' +
                        (item.SeriesName ? '<span class="moonfin-season-detail-series">' + item.SeriesName + '</span>' : '') +
                        '<h1 class="moonfin-season-detail-title">' + item.Name + '</h1>' +
                        '<span class="moonfin-season-detail-count">' + episodes.length + ' Episode' + (episodes.length !== 1 ? 's' : '') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="moonfin-actions">' + seasonActions + '</div>' +
                '<div class="moonfin-season-episodes-list">' +
                    episodeListHtml +
                '</div>' +
            '</div>';

        this.applyBackdropSettings();
        this.setupSeasonPanelListeners(panel, item, episodes);

        if (Tmdb.isEnabled() && item.SeriesId) {
            this.fetchTmdbRatingsForSeasonView(item, episodes);
        }
    },

    fetchTmdbRatingsForSeasonView: function(item, episodes) {
        var self = this;
        Tmdb.resolveSeriesTmdbId(item.SeriesId).then(function(tmdbId) {
            if (!tmdbId) return;
            var season = item.IndexNumber;
            if (season == null) return;

            Tmdb.fetchSeasonRatings(tmdbId, season).then(function(tmdbEpisodes) {
                if (!tmdbEpisodes || tmdbEpisodes.length === 0) return;
                if (!self.currentItem || self.currentItem.Id !== item.Id) return;

                var ratingMap = {};
                for (var i = 0; i < tmdbEpisodes.length; i++) {
                    if (tmdbEpisodes[i].episodeNumber != null) {
                        ratingMap[tmdbEpisodes[i].episodeNumber] = tmdbEpisodes[i];
                    }
                }

                var epCards = self.container.querySelectorAll('.moonfin-season-ep');
                for (var j = 0; j < epCards.length; j++) {
                    var epId = epCards[j].getAttribute('data-item-id');
                    for (var k = 0; k < episodes.length; k++) {
                        if (episodes[k].Id === epId && episodes[k].IndexNumber != null) {
                            var tmdbRating = ratingMap[episodes[k].IndexNumber];
                            if (tmdbRating) {
                                var metaEl = epCards[j].querySelector('.moonfin-season-ep-meta');
                                if (metaEl) {
                                    metaEl.insertAdjacentHTML('afterbegin', Tmdb.buildCompactRatingHtml(tmdbRating));
                                }
                            }
                            break;
                        }
                    }
                }
            });
        });
    },

    setupSeasonPanelListeners: function(panel, item, episodes) {
        var self = this;

        var backBtn = panel.querySelector('.moonfin-details-back');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                if (item.SeriesId) {
                    self.showDetails(item.SeriesId, 'Series');
                } else {
                    self.hide();
                }
            });
        }

        var actionBtns = panel.querySelectorAll('[data-action]');
        for (var j = 0; j < actionBtns.length; j++) {
            (function(btn) {
                btn.addEventListener('click', function() {
                    var action = btn.getAttribute('data-action');
                    self.handleSeasonAction(action, item, episodes);
                });
            })(actionBtns[j]);
        }

        var episodeCards = panel.querySelectorAll('.moonfin-season-ep');
        for (var i = 0; i < episodeCards.length; i++) {
            (function(card) {
                card.addEventListener('click', function() {
                    self.showDetails(card.getAttribute('data-item-id'), 'Episode');
                });
            })(episodeCards[i]);
        }
    },

    handleSeasonAction: function(action, item, episodes) {
        var self = this;
        var api = API.getApiClient();

        switch (action) {
            case 'play':
                if (episodes.length === 0) return;
                var firstUnwatched = null;
                for (var i = 0; i < episodes.length; i++) {
                    if (!episodes[i].UserData || !episodes[i].UserData.Played) {
                        firstUnwatched = episodes[i];
                        break;
                    }
                }
                var playTarget = firstUnwatched || episodes[0];
                self.hide(true);
                self.playItem(playTarget.Id, playTarget.UserData && playTarget.UserData.PlaybackPositionTicks ? playTarget.UserData.PlaybackPositionTicks : 0);
                break;

            case 'shuffle':
                if (episodes.length === 0) return;
                self.hide(true);
                var ids = episodes.map(function(ep) { return ep.Id; });
                for (var s = ids.length - 1; s > 0; s--) {
                    var r = Math.floor(Math.random() * (s + 1));
                    var temp = ids[s];
                    ids[s] = ids[r];
                    ids[r] = temp;
                }
                if (typeof api.sendPlayCommand === 'function') {
                    var deviceId = api.deviceId();
                    api.getSessions({ DeviceId: deviceId }).then(function(sessions) {
                        if (sessions && sessions.length > 0) {
                            return api.sendPlayCommand(sessions[0].Id, {
                                ItemIds: ids,
                                PlayCommand: 'PlayNow',
                                StartPositionTicks: 0
                            });
                        }
                        throw new Error('No session');
                    }).catch(function() {
                        self._shuffleViaSession(ids);
                    });
                } else {
                    self._shuffleViaSession(ids);
                }
                break;

            case 'favorite':
                this.toggleFavorite(item);
                break;

            case 'played':
                this.togglePlayed(item);
                break;

            case 'more':
                self.showMoreMenu(item);
                break;
        }
    },

    renderPersonDetails: function(item, personItems) {
        var self = this;
        var panel = this.container.querySelector('.moonfin-details-panel');
        var api = API.getApiClient();
        var serverUrl = api._serverAddress;

        var photoTag = item.ImageTags ? item.ImageTags.Primary : null;
        var photoUrl = photoTag ? serverUrl + '/Items/' + item.Id + '/Images/Primary?maxHeight=500&quality=90' : '';

        var birthDate = item.PremiereDate ? new Date(item.PremiereDate) : null;
        var deathDate = item.EndDate ? new Date(item.EndDate) : null;
        var birthPlace = item.ProductionLocations && item.ProductionLocations.length > 0 ? item.ProductionLocations[0] : '';

        var infoItems = [];
        if (birthDate) {
            var birthStr = birthDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            if (deathDate) {
                var deathStr = deathDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
                infoItems.push('<span class="moonfin-info-item">' + birthStr + ' — ' + deathStr + '</span>');
            } else {
                var age = Math.floor((Date.now() - birthDate.getTime()) / 31557600000);
                infoItems.push('<span class="moonfin-info-item">Born ' + birthStr + ' (age ' + age + ')</span>');
            }
        }
        if (birthPlace) {
            infoItems.push('<span class="moonfin-info-item">' + birthPlace + '</span>');
        }
        var infoRowHtml = infoItems.length > 0 ? '<div class="moonfin-info-row">' + infoItems.join('') + '</div>' : '';

        var movies = [];
        var series = [];
        for (var i = 0; i < personItems.length; i++) {
            if (personItems[i].Type === 'Movie') movies.push(personItems[i]);
            else if (personItems[i].Type === 'Series') series.push(personItems[i]);
        }

        var buildFilmCards = function(items) {
            return items.map(function(fi) {
                var fiPosterTag = fi.ImageTags ? fi.ImageTags.Primary : null;
                var fiPosterUrl = fiPosterTag ? serverUrl + '/Items/' + fi.Id + '/Images/Primary?maxHeight=400&quality=80' : '';
                var fiYear = fi.ProductionYear || (fi.PremiereDate ? new Date(fi.PremiereDate).getFullYear() : '');
                var fiWatched = fi.UserData && fi.UserData.Played;
                var fiFavorite = fi.UserData && fi.UserData.IsFavorite;
                return '<div class="moonfin-similar-card moonfin-focusable" data-item-id="' + fi.Id + '" data-type="' + fi.Type + '" tabindex="0">' +
                    '<div class="moonfin-similar-poster">' +
                        (fiPosterUrl ? '<img src="' + fiPosterUrl + '" alt="" loading="lazy">' : '<div class="moonfin-poster-placeholder"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z"/></svg></div>') +
                        (fiFavorite ? self.buildFavoriteIndicator() : '') +
                        (fiWatched ? self.buildWatchedIndicator() : '') +
                    '</div>' +
                    '<span class="moonfin-similar-title">' + fi.Name + '</span>' +
                    (fiYear ? '<span class="moonfin-person-film-year">' + fiYear + '</span>' : '') +
                '</div>';
            }).join('');
        };

        var moviesHtml = movies.length > 0 ? (
            '<div class="moonfin-section">' +
                '<div class="moonfin-section-header">' +
                    '<h3 class="moonfin-section-title">Movies (' + movies.length + ')</h3>' +
                    '<div class="moonfin-section-arrows">' +
                        '<button class="moonfin-section-arrow moonfin-arrow-left" aria-label="Scroll left"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>' +
                        '<button class="moonfin-section-arrow moonfin-arrow-right" aria-label="Scroll right"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>' +
                    '</div>' +
                '</div>' +
                '<div class="moonfin-section-scroll">' + buildFilmCards(movies) + '</div>' +
            '</div>'
        ) : '';

        var seriesHtml = series.length > 0 ? (
            '<div class="moonfin-section">' +
                '<div class="moonfin-section-header">' +
                    '<h3 class="moonfin-section-title">Series (' + series.length + ')</h3>' +
                    '<div class="moonfin-section-arrows">' +
                        '<button class="moonfin-section-arrow moonfin-arrow-left" aria-label="Scroll left"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg></button>' +
                        '<button class="moonfin-section-arrow moonfin-arrow-right" aria-label="Scroll right"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg></button>' +
                    '</div>' +
                '</div>' +
                '<div class="moonfin-section-scroll">' + buildFilmCards(series) + '</div>' +
            '</div>'
        ) : '';

        var isFavorite = item.UserData ? item.UserData.IsFavorite : false;

        var backdrop = this.container.querySelector('.moonfin-details-backdrop');
        if (backdrop) {
            backdrop.style.backgroundImage = '';
            backdrop.className = 'moonfin-details-backdrop moonfin-person-backdrop';
        }

        panel.innerHTML =
            '<button class="moonfin-details-back moonfin-focusable" title="Back" tabindex="0">' +
                '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>' +
            '</button>' +

            '<div class="moonfin-details-content">' +
                '<div class="moonfin-person-header">' +
                    '<div class="moonfin-person-photo-wrapper">' +
                        (photoUrl ? '<img class="moonfin-person-photo" src="' + photoUrl + '" alt="">' : '<div class="moonfin-person-photo moonfin-person-photo-placeholder"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 4a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4m0 10c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4"/></svg></div>') +
                    '</div>' +
                    '<div class="moonfin-person-info">' +
                        '<h1 class="moonfin-title">' + item.Name + '</h1>' +
                        infoRowHtml +
                        (item.Overview ? '<p class="moonfin-overview">' + item.Overview + '</p>' : '') +
                        '<div class="moonfin-action-btns" style="margin-top:16px">' +
                            '<div class="moonfin-btn-wrapper moonfin-focusable ' + (isFavorite ? 'active' : '') + '" data-action="favorite" tabindex="0">' +
                                '<div class="moonfin-btn-circle">' +
                                    '<svg viewBox="0 -960 960 960" fill="currentColor"><path d="' + (isFavorite ?
                                        'm480-120-58-52q-101-91-167-157T150-447.5Q111-500 95.5-544T80-634q0-94 63-157t157-63q52 0 99 22t81 62q34-40 81-62t99-22q94 0 157 63t63 157q0 46-15.5 90T810-447.5Q771-395 705-329T538-172l-58 52Z' :
                                        'M480-120q-14 0-28.5-5T426-140q-43-38-97.5-82.5T232-308q-41.5-41.5-72-83T122-475q-8-32-11-60.5T108-596q0-86 57-147t147-61q52 0 99 22t69 62q22-40 69-62t99-22q90 0 147 61t57 147q0 32-3 60.5T837-475q-7 42-37.5 83.5T728-308q-42 42-96.5 86.5T534-140q-11 10-25.5 15t-28.5 5Zm0-80q41-37 88.5-75t83-68.5q35.5-30.5 61-58T746-456q9-27 11.5-49t2.5-43q0-53-34.5-91.5T636-678q-43 0-77.5 24T507-602h-54q-17-28-51.5-52T324-678q-55 0-89.5 38.5T200-548q0 21 2.5 43t11.5 49q9 27 34.5 54.5t61 58Q345-313 392.5-275T480-200Z') +
                                    '"/></svg>' +
                                '</div>' +
                                '<span class="moonfin-btn-label">' + (isFavorite ? 'Favorited' : 'Favorite') + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>' +

                '<div class="moonfin-sections">' +
                    moviesHtml +
                    seriesHtml +
                '</div>' +
            '</div>';

        this.applyBackdropSettings();
        this.setupPersonPanelListeners(panel, item);
    },

    setupPersonPanelListeners: function(panel, item) {
        var self = this;

        var backBtn = panel.querySelector('.moonfin-details-back');
        if (backBtn) backBtn.addEventListener('click', function() { self.hide(); });

        var favBtn = panel.querySelector('[data-action="favorite"]');
        if (favBtn) favBtn.addEventListener('click', function() { self.toggleFavorite(item); });

        var filmCards = panel.querySelectorAll('.moonfin-similar-card');
        for (var i = 0; i < filmCards.length; i++) {
            (function(card) {
                card.addEventListener('click', function() {
                    self.showDetails(card.getAttribute('data-item-id'), card.getAttribute('data-type'));
                });
            })(filmCards[i]);
        }

        this.setupScrollArrows(panel);
    },

    hide: function(skipHistoryBack) {
        if (!this.isVisible) return;
        this.closeTrailerOverlay();
        this.container.classList.remove('visible');
        this.isVisible = false;
        this.currentItem = null;
        this._itemHistory = [];
        document.body.classList.remove('moonfin-details-visible');
        this._updateBackButtons();

        if (!skipHistoryBack) {
            try { history.back(); } catch(e) {}
        }
    }
};


// === plugin.js ===
const Plugin = {
    version: '1.8.2',
    name: 'Moonfin Web Plugin',
    initialized: false,
    _initializing: false,
    _currentUserId: null,

    isHomePage() {
        const hash = window.location.hash.toLowerCase();
        if (hash === '#/home' || hash === '#/home.html') return true;
        if (hash.startsWith('#/home?') || hash.startsWith('#/home.html?')) {
            // Exclude tab-based sub-pages (e.g. favorites, collections)
            return hash.indexOf('tab=') === -1;
        }
        return false;
    },

    isAdminPage() {
        const hash = window.location.hash.toLowerCase();

        // Whitelist of known user-facing routes.
        // Everything else (dashboard pages, plugin config, user management,
        // scheduled tasks, networking, etc.) is treated as admin so the
        // plugin stays out of the way and never blocks the admin panel.
        const userRoutes = [
            '#/home',
            '#/index',
            '#/movies',
            '#/tvshows',
            '#/tv',
            '#/music',
            '#/livetv',
            '#/details',
            '#/item',
            '#/library',
            '#/genre',
            '#/person',
            '#/collection',
            '#/boxset',
            '#/studio',
            '#/folders',
            '#/search',
            '#/favorites',
            '#/list',
            '#/mypreferencesmenu',
            '#/mypreferencesdisplay',
            '#/mypreferenceshome',
            '#/mypreferencesplayback',
            '#/mypreferencessubtitles',
            '#/mypreferencescontrol',
            '#/mypreferencesquickconnect',
            '#/video'
        ];

        // Empty hash (root) is a user page
        if (hash === '' || hash === '#' || hash === '#/') {
            return false;
        }

        // Check if the current hash starts with any known user route
        for (const route of userRoutes) {
            if (hash === route || hash.startsWith(route + '.html') ||
                hash.startsWith(route + '?') || hash.startsWith(route + '/')) {
                return false;
            }
        }

        // Any page not in the user whitelist is treated as admin
        return true;
    },

    async init() {
        if (this.initialized || this._initializing) return;
        this._initializing = true;

        if (!this._listenersRegistered) {
            this.setupGlobalListeners();
            this._listenersRegistered = true;
        }

        if (this.isAdminPage()) {
            console.log('[Moonfin] Skipping initialization on admin page');
            this._initializing = false;
            return;
        }

        console.log(`[Moonfin] ${this.name} v${this.version} initializing...`);

        Device.detect();

        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }

        this.loadStyles();
        this.applyDeviceClasses();

        this._currentUserId = this._getLoggedInUserId();

        Storage.checkUserOwnership(this._currentUserId);
        Storage.initSync();

        try {
            var settings = Storage.getAll();

            if (settings.navbarEnabled) {
                if (settings.navbarPosition === 'left') {
                    await Sidebar.init();
                } else {
                    await Navbar.init();
                }
            }

            this.applyParadoxMediaBarSuppression(settings);

            if (this.shouldUseMoonfinMediaBar(settings)) {
                MediaBar.init();
            }

            Genres.init();
            Library.init();
            MdbList.init();
            await Jellyseerr.init();
            Details.init();
            SyncPlay.init();
            this.initSeasonalEffects();
            await this.seedHomeRowOrder();
            await this.syncHomeRowsV2FromServer();

            if (Device.isTV()) {
                TVNavigation.init();
            }
        } catch (e) {
            console.error('[Moonfin] Error initializing components:', e);
        }

        this.initialized = true;
        this._initializing = false;
        console.log('[Moonfin] Plugin initialized successfully');
    },

    applyDeviceClasses() {
        const device = Device.getInfo();
        document.body.classList.toggle('moonfin-mobile', device.isMobile);
        document.body.classList.toggle('moonfin-desktop', device.isDesktop);
        document.body.classList.toggle('moonfin-tv', device.isTV);
        document.body.classList.toggle('moonfin-touch', device.hasTouch);
        document.body.dataset.moonfinDevice = device.type;
    },

    getDesktopMediaBarProvider(settings) {
        if (Device.getProfileName() !== 'desktop') return null;
        var desktopProfile = Storage.getProfile('desktop') || {};
        var provider = String(desktopProfile.desktopMediaBarProvider || '').toLowerCase();
        if (provider === 'paradox' || provider === 'enhanced' || provider === 'moonfin' || provider === 'off') {
            return provider;
        }
        return settings.mediaBarEnabled ? 'moonfin' : 'off';
    },

    shouldUseMoonfinMediaBar(settings) {
        var provider = this.getDesktopMediaBarProvider(settings);
        if (provider === null) return !!settings.mediaBarEnabled;
        return provider === 'moonfin';
    },

    _collectionTypeFromRoute(route) {
        var map = { movies: 'movies', tv: 'tvshows', music: 'music', homevideos: 'homevideos', musicvideos: 'musicvideos', books: 'books' };
        return map[route] || '';
    },

    _resolveLibraryName(libraryId) {
        var libs = (Navbar.initialized && Navbar.libraries) || (Sidebar.initialized && Sidebar.libraries) || [];
        for (var i = 0; i < libs.length; i++) {
            if (libs[i].Id === libraryId) return libs[i].Name || 'Library';
        }
        return 'Library';
    },

    _tryOpenLibraryFromHash() {
        if (Storage.get('libraryPageEnabled') === false) return false;
        var hash = window.location.hash || '';
        var match = hash.match(/^#\/(movies|tv|music|homevideos|musicvideos|books|list)(?:[/?#]|$)/);
        if (!match) return false;
        var queryStr = hash.indexOf('?') !== -1 ? hash.slice(hash.indexOf('?') + 1) : '';
        var params = new URLSearchParams(queryStr);
        var libraryId = params.get('topParentId') || params.get('parentId');
        if (!libraryId) return false;
        if (Library.isVisible && Library.libraryId === libraryId) return true;
        var collectionType = params.get('collectionType') || this._collectionTypeFromRoute(match[1]);
        Library.show(libraryId, this._resolveLibraryName(libraryId), collectionType);
        return true;
    },

    shouldSuppressParadoxMediaBar(settings) {
        var provider = this.getDesktopMediaBarProvider(settings);
        return provider === 'off' || provider === 'moonfin' || provider === 'enhanced';
    },

    applyParadoxMediaBarSuppression(settings) {
        var styleId = 'moonfin-paradox-mediabar-suppress-style';
        var existing = document.getElementById(styleId);
        if (!this.shouldSuppressParadoxMediaBar(settings)) {
            if (existing) existing.remove();
            return;
        }

        if (existing) return;
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent =
            '#slides-container, #page-loader, .bar-loading { display: none !important; visibility: hidden !important; }' +
            'body:not(.moonfin-mediabar-active) .homeSectionsContainer { top: 0 !important; }';
        document.head.appendChild(style);
    },

    applyHomeRowOrder() {
        const homeRowOrder = Storage.get('homeRowOrder');
        if (!homeRowOrder || !homeRowOrder.length) return;

        const api = API.getApiClient();
        if (!api) return;

        const userId = api.getCurrentUserId();
        if (!userId) return;

        const customPrefs = {};
        for (let i = 0; i < 8; i++) {
            customPrefs['homesection' + i] = i < homeRowOrder.length ? homeRowOrder[i] : 'none';
        }

        api.getDisplayPreferences('usersettings', userId, 'emby').then(function(prefs) {
            let changed = false;
            for (const key in customPrefs) {
                if (prefs.CustomPrefs[key] !== customPrefs[key]) {
                    prefs.CustomPrefs[key] = customPrefs[key];
                    changed = true;
                }
            }
            if (!changed) return false;
            return api.updateDisplayPreferences('usersettings', prefs, userId, 'emby').then(function() { return true; });
        }).then(function(updated) {
            if (updated) {
                console.log('[Moonfin] Home row order applied');
            }
        }).catch(function(err) {
            console.error('[Moonfin] Failed to apply home row order', err);
        });
    },

    async seedHomeRowOrder() {
        const profiles = Storage.getProfiles();
        const hasExplicit = Object.keys(profiles).some(function(key) {
            return profiles[key].homeRowOrder && profiles[key].homeRowOrder.length;
        });
        if (hasExplicit) {
            this.applyHomeRowOrder();
            return;
        }

        const api = API.getApiClient();
        if (!api) return;

        const userId = api.getCurrentUserId();
        if (!userId) return;

        try {
            const prefs = await api.getDisplayPreferences('usersettings', userId, 'emby');
            const customPrefs = prefs.CustomPrefs || {};
            const order = [];
            for (let i = 0; i < 8; i++) {
                const val = customPrefs['homesection' + i];
                if (val && val !== 'none') {
                    order.push(val);
                }
            }
            if (order.length) {
                Storage.set('homeRowOrder', order);
                console.log('[Moonfin] Seeded home row order from server:', order);
            }
        } catch (err) {
            console.error('[Moonfin] Failed to fetch home row order', err);
        }
    },

    async syncHomeRowsV2FromServer() {
        const profile = Device.getProfileName() || 'global';
        const apiClient = API.getApiClient();
        const userId = apiClient ? apiClient.getCurrentUserId?.() : null;
        const language = userId ? (localStorage.getItem(userId + '-language') || (navigator.language || 'en')) : (navigator.language || 'en');

        let nextRows = null;
        let nextSource = null;

        try {
            const result = await API.getHomeRows(profile, language);
            const rows = result && Array.isArray(result.rows) ? result.rows : [];
            const source = result && result.source ? String(result.source).toLowerCase() : null;

            if (rows.length > 0) {
                nextRows = rows;
                nextSource = source || 'moonfin';
            }
        } catch {}

        this.persistHomeRowsV2Profile(profile, nextRows, nextSource);
    },

    persistHomeRowsV2Profile(profileName, rows, source) {
        profileName = profileName || 'global';
        const profile = Storage.getProfile(profileName);
        const currentRows = profile.homeRowsV2 === undefined ? null : profile.homeRowsV2;
        const currentSource = profile.homeRowsSource === undefined ? null : profile.homeRowsSource;

        const nextRows = rows && rows.length ? rows : null;
        const nextSource = source || null;

        if (JSON.stringify(currentRows) === JSON.stringify(nextRows) && currentSource === nextSource) {
            return;
        }

        if (nextRows === null) {
            delete profile.homeRowsV2;
            delete profile.homeRowsSource;
        } else {
            profile.homeRowsV2 = nextRows;
            profile.homeRowsSource = nextSource;
        }

        Storage.saveProfile(profileName, profile);
    },

    loadStyles() {
        if (document.querySelector('link[href*="moonfin"]') || 
            document.querySelector('style[data-moonfin]')) {
            return;
        }

        const cssUrl = this.getPluginUrl('plugin.css');
        if (cssUrl) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = cssUrl;
            document.head.appendChild(link);
        }
    },

    getPluginUrl(filename) {
        const scripts = document.querySelectorAll('script[src*="moonfin"]');
        if (scripts.length > 0) {
            const scriptSrc = scripts[0].src;
            return scriptSrc.replace(/[^/]+$/, filename);
        }
        return null;
    },

    initSeasonalEffects() {
        const settings = Storage.getAll();
        this.applySeasonalEffect(settings.seasonalSurprise);

        window.addEventListener('moonfin-settings-changed', (e) => {
            this.applySeasonalEffect(e.detail.seasonalSurprise);
        });
        
        window.addEventListener('hashchange', () => {
            const settings = Storage.getAll();
            this.applySeasonalEffect(settings.seasonalSurprise);
        });
    },

    _seasonalState: null,

    applySeasonalEffect(effect) {
        if (this._seasonalState) {
            this._seasonalState.stop();
            this._seasonalState = null;
        }
        document.querySelectorAll('.moonfin-seasonal-effect').forEach(el => el.remove());

        if (this.isAdminPage()) return;
        if (!effect || effect === 'none') return;

        const container = document.createElement('div');
        container.className = 'moonfin-seasonal-effect';
        document.body.appendChild(container);

        const engine = this._createSeasonalEngine(container, effect);
        if (engine) {
            this._seasonalState = engine;
            engine.start();
        }
    },

    _sineTable: (() => {
        const t = new Float32Array(360);
        for (let i = 0; i < 360; i++) t[i] = Math.sin(i * Math.PI / 180);
        return t;
    })(),

    _createSeasonalEngine(container, effect) {
        const w = () => window.innerWidth;
        const h = () => window.innerHeight;
        const sin = this._sineTable;
        let raf = null;
        let running = false;
        let frame = 0;
        const els = [];

        function makeEl(emoji, size) {
            const el = document.createElement('div');
            el.className = 'moonfin-particle';
            el.textContent = emoji;
            el.style.fontSize = size + 'px';
            el.style.position = 'absolute';
            el.style.willChange = 'transform, opacity';
            container.appendChild(el);
            return el;
        }

        function removeEl(el) {
            el.remove();
        }

        function posEl(el, x, y, opacity, extra) {
            let t = `translate(${x}px, ${y}px)`;
            if (extra) t += ' ' + extra;
            el.style.transform = t;
            el.style.opacity = opacity;
        }

        const config = this._getSeasonConfig(effect);
        if (!config) return null;

        const state = {
            particles: [],
            specials: [],
            specialTimer: 0,
            specialInterval: config.specialInterval || 300
        };

        return {
            start() {
                running = true;
                config.init(state, w(), h(), makeEl);
                const tick = () => {
                    if (!running) return;
                    frame++;
                    config.update(state, w(), h(), frame, makeEl, removeEl, posEl, sin);
                    raf = requestAnimationFrame(tick);
                };
                raf = requestAnimationFrame(tick);
            },
            stop() {
                running = false;
                if (raf) cancelAnimationFrame(raf);
                state.particles.forEach(p => { if (p.el) p.el.remove(); });
                state.specials.forEach(s => { if (s.el) s.el.remove(); });
                state.particles = [];
                state.specials = [];
            }
        };
    },

    _getSeasonConfig(effect) {
        switch (effect) {
            case 'winter': return this._winterConfig();
            case 'spring': return this._springConfig();
            case 'summer': return this._summerConfig();
            case 'fall': return this._fallConfig();
            case 'halloween': return this._halloweenConfig();
            default: return null;
        }
    },

    _winterConfig() {
        const COUNT = 30;
        const SNOWMAN_COUNT = 4;
        return {
            specialInterval: 500,
            init(state, W, H, makeEl) {
                for (let i = 0; i < COUNT; i++) {
                    const size = 12 + Math.random() * 10;
                    state.particles.push({
                        el: makeEl('❄️', size),
                        x: Math.random() * W,
                        y: Math.random() * H,
                        size,
                        speed: 0.15 + Math.random() * 0.35,
                        driftAmp: 8 + Math.random() * 12,
                        driftIdx: Math.floor(Math.random() * 360),
                        driftSpd: 1 + Math.floor(Math.random() * 3),
                        rot: Math.random() * 360,
                        rotSpd: Math.random() * 0.8 - 0.4,
                        alpha: 0.7 + Math.random() * 0.3
                    });
                }
            },
            update(state, W, H, frame, makeEl, removeEl, posEl, sin) {
                state.particles.forEach((p, i) => {
                    p.y += p.speed;
                    p.driftIdx = (p.driftIdx + p.driftSpd) % 360;
                    p.x += sin[p.driftIdx] * p.driftAmp * 0.015;
                    p.rot += p.rotSpd;
                    if (p.y > H + p.size) { p.y = -p.size * 2; p.x = Math.random() * W; }
                    if (p.x < -p.size) p.x = W + p.size;
                    else if (p.x > W + p.size) p.x = -p.size;
                    posEl(p.el, p.x, p.y, p.alpha, `rotate(${p.rot}deg)`);
                });

                state.specialTimer++;
                const active = state.specials.filter(s => s.state !== 'done');
                if (state.specialTimer >= state.specialInterval && active.length === 0) {
                    state.specialTimer = 0;
                    const groundY = H - 40;
                    const spacing = W / (SNOWMAN_COUNT + 1);
                    for (let i = 0; i < SNOWMAN_COUNT; i++) {
                        state.specials.push({
                            el: makeEl('⛄', 35),
                            x: spacing * (i + 1) + Math.random() * 40 - 20,
                            y: H + 40,
                            vy: 0,
                            groundY,
                            state: 'wait',
                            alpha: 1,
                            bounces: 0,
                            wait: i * 30 + Math.floor(Math.random() * 40)
                        });
                    }
                }

                for (let i = state.specials.length - 1; i >= 0; i--) {
                    const s = state.specials[i];
                    switch (s.state) {
                        case 'wait':
                            s.wait--;
                            if (s.wait <= 0) { s.state = 'rise'; s.vy = -3; }
                            posEl(s.el, s.x, s.y, 0);
                            break;
                        case 'rise':
                            s.vy += 0.15;
                            s.y += s.vy;
                            if (s.y >= s.groundY) {
                                s.y = s.groundY;
                                s.bounces++;
                                s.state = s.bounces >= 1 ? 'fade' : 'rise';
                                s.vy = s.bounces >= 1 ? 0 : -3 * 0.3;
                            }
                            posEl(s.el, s.x, s.y, 1);
                            break;
                        case 'fade':
                            s.alpha -= 0.005;
                            if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                            else posEl(s.el, s.x, s.y, s.alpha);
                            break;
                        case 'done':
                            break;
                    }
                }
                state.specials = state.specials.filter(s => s.state !== 'done');
            }
        };
    },

    _springConfig() {
        const PETAL_COUNT = 20;
        const BEE_COUNT = 3;
        return {
            specialInterval: 500,
            init(state, W, H, makeEl) {
                for (let i = 0; i < PETAL_COUNT; i++) {
                    const size = 14 + Math.random() * 10;
                    state.particles.push({
                        el: makeEl(Math.random() > 0.2 ? '🌸' : '🌼', size),
                        x: Math.random() * W,
                        y: Math.random() * H,
                        size,
                        speed: 0.1 + Math.random() * 0.2,
                        driftAmp: 15 + Math.random() * 20,
                        driftIdx: Math.floor(Math.random() * 360),
                        driftSpd: 1 + Math.floor(Math.random() * 2),
                        rot: Math.random() * 360,
                        rotSpd: 0.1 + Math.random() * 0.4,
                        alpha: 0.7 + Math.random() * 0.3
                    });
                }
            },
            update(state, W, H, frame, makeEl, removeEl, posEl, sin) {
                state.particles.forEach(p => {
                    p.y += p.speed;
                    p.driftIdx = (p.driftIdx + p.driftSpd) % 360;
                    p.x += sin[p.driftIdx] * p.driftAmp * 0.012;
                    p.rot += p.rotSpd;
                    if (p.y > H + p.size) { p.y = -p.size * 2; p.x = Math.random() * W; }
                    if (p.x < -p.size) p.x = W + p.size;
                    else if (p.x > W + p.size) p.x = -p.size;
                    posEl(p.el, p.x, p.y, p.alpha, `rotate(${p.rot}deg)`);
                });

                // Bees fly side to side with vertical buzz
                state.specialTimer++;
                const activeBees = state.specials.filter(s => s.state !== 'done');
                if (state.specialTimer >= state.specialInterval && activeBees.length === 0) {
                    state.specialTimer = 0;
                    const usableH = H * 0.6;
                    const topMargin = H * 0.2;
                    const zoneH = usableH / BEE_COUNT;
                    for (let i = 0; i < BEE_COUNT; i++) {
                        const fromLeft = Math.random() > 0.5;
                        const startX = fromLeft ? -40 : W + 40;
                        const baseY = topMargin + zoneH * i + zoneH * 0.2 + Math.random() * (zoneH * 0.6);
                        state.specials.push({
                            el: makeEl('🐝', 24),
                            x: startX,
                            y: baseY,
                            targetX: fromLeft ? W + 40 : -40,
                            speed: 0.6 + Math.random() * 0.4,
                            state: 'wait',
                            alpha: 1,
                            wait: i * 30 + 15 + Math.floor(Math.random() * 30),
                            buzzIdx: Math.floor(Math.random() * 360),
                            buzzSpd: 4 + Math.floor(Math.random() * 4),
                            buzzAmp: 1.2 + Math.random() * 0.8,
                            fromLeft
                        });
                    }
                }

                for (let i = state.specials.length - 1; i >= 0; i--) {
                    const s = state.specials[i];
                    switch (s.state) {
                        case 'wait':
                            s.wait--;
                            if (s.wait <= 0) s.state = 'fly';
                            posEl(s.el, s.x, s.y, 0);
                            break;
                        case 'fly':
                            s.x += s.fromLeft ? s.speed : -s.speed;
                            s.buzzIdx = (s.buzzIdx + s.buzzSpd) % 360;
                            s.y += sin[s.buzzIdx] * s.buzzAmp * 0.3;
                            const reached = s.fromLeft ? s.x > s.targetX : s.x < s.targetX;
                            if (reached) s.state = 'fade';
                            posEl(s.el, s.x, s.y, 1, s.fromLeft ? 'scaleX(-1)' : '');
                            break;
                        case 'fade':
                            s.alpha -= 0.01;
                            if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                            else posEl(s.el, s.x, s.y, s.alpha);
                            break;
                        case 'done': break;
                    }
                }
                state.specials = state.specials.filter(s => s.state !== 'done');
            }
        };
    },

    _summerConfig() {
        const BALL_COUNT = 2;
        const SUN_MAX = 2;
        const UMBRELLA_COUNT = 3;
        return {
            specialInterval: 400,
            init(state, W, H, makeEl) {
                state._sunTimer = 0;
                state._sunInterval = 250;
                state._umbrellaTimer = 0;
                state._umbrellaInterval = 600;
                state._suns = [];
                state._umbrellas = [];
            },
            update(state, W, H, frame, makeEl, removeEl, posEl, sin) {
                // Beach balls bounce side to side
                state.specialTimer++;
                const activeBalls = state.specials.filter(s => s.state !== 'done');
                if (state.specialTimer >= state.specialInterval && activeBalls.length === 0) {
                    state.specialTimer = 0;
                    const usableH = H * 0.5;
                    const topMargin = H * 0.3;
                    const zoneH = usableH / BALL_COUNT;
                    for (let i = 0; i < BALL_COUNT; i++) {
                        const fromLeft = Math.random() > 0.5;
                        const startX = fromLeft ? -50 : W + 50;
                        const baseY = topMargin + zoneH * i + zoneH * 0.3 + Math.random() * (zoneH * 0.4);
                        state.specials.push({
                            el: makeEl('🏐', 28),
                            x: startX,
                            y: baseY,
                            baseY,
                            targetX: fromLeft ? W + 50 : -50,
                            speed: 0.5 + Math.random() * 0.3,
                            state: 'wait',
                            alpha: 1,
                            wait: i * 40 + 15 + Math.floor(Math.random() * 35),
                            bounceIdx: Math.floor(Math.random() * 360),
                            bounceSpd: 1 + Math.floor(Math.random() * 2),
                            bounceAmp: 35 + Math.random() * 15,
                            fromLeft
                        });
                    }
                }

                for (let i = state.specials.length - 1; i >= 0; i--) {
                    const s = state.specials[i];
                    switch (s.state) {
                        case 'wait':
                            s.wait--;
                            if (s.wait <= 0) s.state = 'bounce';
                            posEl(s.el, s.x, s.y, 0);
                            break;
                        case 'bounce':
                            s.x += s.fromLeft ? s.speed : -s.speed;
                            s.bounceIdx = (s.bounceIdx + s.bounceSpd) % 360;
                            s.y = s.baseY + sin[s.bounceIdx] * s.bounceAmp * 0.3;
                            const reached = s.fromLeft ? s.x > W + 50 : s.x < -50;
                            if (reached) s.state = 'fade';
                            posEl(s.el, s.x, s.y, 1, `rotate(${s.bounceIdx * 2}deg)`);
                            break;
                        case 'fade':
                            s.alpha -= 0.01;
                            if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                            else posEl(s.el, s.x, s.y, s.alpha);
                            break;
                        case 'done': break;
                    }
                }
                state.specials = state.specials.filter(s => s.state !== 'done');

                // Suns: appear, pulse, fade
                state._sunTimer++;
                const activeSuns = state._suns.filter(s => s.state !== 'done');
                if (state._sunTimer >= state._sunInterval && activeSuns.length < SUN_MAX) {
                    state._sunTimer = 0;
                    const x = 50 + Math.random() * (W - 100);
                    const y = 50 + Math.random() * (H * 0.4);
                    state._suns.push({
                        el: makeEl('☀️', 32),
                        x, y,
                        state: 'wait',
                        alpha: 0,
                        wait: Math.floor(Math.random() * 60),
                        scale: 0.5,
                        pulses: 0
                    });
                }

                for (let i = state._suns.length - 1; i >= 0; i--) {
                    const s = state._suns[i];
                    switch (s.state) {
                        case 'wait':
                            s.wait--;
                            if (s.wait <= 0) s.state = 'pulseIn';
                            posEl(s.el, s.x, s.y, 0);
                            break;
                        case 'pulseIn':
                            s.alpha = Math.min(1, s.alpha + 0.012);
                            s.scale = Math.min(1.2, s.scale + 0.006);
                            if (s.scale >= 1.2) s.state = 'pulseOut';
                            posEl(s.el, s.x, s.y, s.alpha, `scale(${s.scale})`);
                            break;
                        case 'pulseOut':
                            s.scale = Math.max(0.8, s.scale - 0.006);
                            if (s.scale <= 0.8) {
                                s.pulses++;
                                s.state = s.pulses >= 2 ? 'fade' : 'pulseIn';
                            }
                            posEl(s.el, s.x, s.y, s.alpha, `scale(${s.scale})`);
                            break;
                        case 'fade':
                            s.alpha -= 0.005;
                            s.scale -= 0.004;
                            if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                            else posEl(s.el, s.x, s.y, s.alpha, `scale(${s.scale})`);
                            break;
                        case 'done': break;
                    }
                }
                state._suns = state._suns.filter(s => s.state !== 'done');

                // Umbrellas: pop up from bottom, settle, fade
                state._umbrellaTimer++;
                const activeUmbrellas = state._umbrellas.filter(s => s.state !== 'done');
                if (state._umbrellaTimer >= state._umbrellaInterval && activeUmbrellas.length === 0) {
                    state._umbrellaTimer = 0;
                    const groundY = H - 40;
                    const spacing = W / (UMBRELLA_COUNT + 1);
                    for (let i = 0; i < UMBRELLA_COUNT; i++) {
                        state._umbrellas.push({
                            el: makeEl('⛱️', 32),
                            x: spacing * (i + 1) + Math.random() * 40 - 20,
                            y: H + 40,
                            vy: -1.5,
                            groundY,
                            state: 'wait',
                            alpha: 1,
                            wait: i * 25 + Math.floor(Math.random() * 30)
                        });
                    }
                }

                for (let i = state._umbrellas.length - 1; i >= 0; i--) {
                    const s = state._umbrellas[i];
                    switch (s.state) {
                        case 'wait':
                            s.wait--;
                            if (s.wait <= 0) s.state = 'rise';
                            posEl(s.el, s.x, s.y, 0);
                            break;
                        case 'rise':
                            s.y += s.vy;
                            if (s.y <= s.groundY) { s.y = s.groundY; s.state = 'settle'; }
                            posEl(s.el, s.x, s.y, 1);
                            break;
                        case 'settle':
                            s.state = 'fade';
                            posEl(s.el, s.x, s.y, 1);
                            break;
                        case 'fade':
                            s.alpha -= 0.005;
                            if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                            else posEl(s.el, s.x, s.y, s.alpha);
                            break;
                        case 'done': break;
                    }
                }
                state._umbrellas = state._umbrellas.filter(s => s.state !== 'done');
            }
        };
    },

    _fallConfig() {
        const LEAF_COUNT = 18;
        const PUMPKIN_COUNT = 4;
        const leafHues = [0, -20, 30]; // orange, red-ish, yellow-brown via hue-rotate
        return {
            specialInterval: 500,
            init(state, W, H, makeEl) {
                for (let i = 0; i < LEAF_COUNT; i++) {
                    const size = 16 + Math.random() * 10;
                    const colorIdx = Math.floor(Math.random() * 3);
                    const el = makeEl('🍁', size);
                    if (leafHues[colorIdx] !== 0) {
                        el.style.filter = `hue-rotate(${leafHues[colorIdx]}deg)`;
                    }
                    state.particles.push({
                        el,
                        x: Math.random() * W,
                        y: Math.random() * H,
                        size,
                        speed: 0.1 + Math.random() * 0.2,
                        driftAmp: 20 + Math.random() * 25,
                        driftIdx: Math.floor(Math.random() * 360),
                        driftSpd: 1 + Math.floor(Math.random() * 2),
                        rot: Math.random() * 360,
                        rotSpd: 0.1 + Math.random() * 0.4,
                        alpha: 0.8 + Math.random() * 0.2
                    });
                }
            },
            update(state, W, H, frame, makeEl, removeEl, posEl, sin) {
                state.particles.forEach(p => {
                    p.y += p.speed;
                    p.driftIdx = (p.driftIdx + p.driftSpd) % 360;
                    p.x += sin[p.driftIdx] * p.driftAmp * 0.01;
                    p.rot += p.rotSpd;
                    if (p.y > H + p.size) { p.y = -p.size * 2; p.x = Math.random() * W; }
                    if (p.x < -p.size) p.x = W + p.size;
                    else if (p.x > W + p.size) p.x = -p.size;
                    posEl(p.el, p.x, p.y, p.alpha, `rotate(${p.rot}deg)`);
                });

                // Pumpkins pop up from bottom, bounce, fade
                state.specialTimer++;
                const active = state.specials.filter(s => s.state !== 'done');
                if (state.specialTimer >= state.specialInterval && active.length === 0) {
                    state.specialTimer = 0;
                    const groundY = H - 40;
                    const spacing = W / (PUMPKIN_COUNT + 1);
                    for (let i = 0; i < PUMPKIN_COUNT; i++) {
                        state.specials.push({
                            el: makeEl('🎃', 32),
                            x: spacing * (i + 1) + Math.random() * 40 - 20,
                            y: H + 40,
                            vy: 0,
                            groundY,
                            state: 'wait',
                            alpha: 1,
                            bounces: 0,
                            wait: i * 30 + Math.floor(Math.random() * 40)
                        });
                    }
                }

                for (let i = state.specials.length - 1; i >= 0; i--) {
                    const s = state.specials[i];
                    switch (s.state) {
                        case 'wait':
                            s.wait--;
                            if (s.wait <= 0) { s.state = 'rise'; s.vy = -3; }
                            posEl(s.el, s.x, s.y, 0);
                            break;
                        case 'rise':
                            s.vy += 0.15;
                            s.y += s.vy;
                            if (s.y >= s.groundY) {
                                s.y = s.groundY;
                                s.bounces++;
                                s.state = s.bounces >= 1 ? 'fade' : 'rise';
                                s.vy = s.bounces >= 1 ? 0 : -3 * 0.3;
                            }
                            posEl(s.el, s.x, s.y, 1);
                            break;
                        case 'fade':
                            s.alpha -= 0.005;
                            if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                            else posEl(s.el, s.x, s.y, s.alpha);
                            break;
                        case 'done': break;
                    }
                }
                state.specials = state.specials.filter(s => s.state !== 'done');
            }
        };
    },

    _halloweenConfig() {
        const CANDY_COUNT = 12;
        const GHOST_COUNT = 3;
        const PUMPKIN_COUNT = 3;
        const MAX_SPIDERS = 2;
        const candyHues = [0, 60, 180, 270]; // red, yellow, teal, purple via hue-rotate
        return {
            specialInterval: 500,
            init(state, W, H, makeEl) {
                state._ghostTimer = 0;
                state._ghostInterval = 500;
                state._ghosts = [];
                state._pumpkinTimer = 0;
                state._pumpkinInterval = 650;
                state._pumpkins = [];
                state._spiderTimer = 0;
                state._spiderInterval = 250;
                state._spiders = [];

                for (let i = 0; i < CANDY_COUNT; i++) {
                    const size = 12 + Math.random() * 6;
                    const el = makeEl('🍬', size);
                    const hue = candyHues[Math.floor(Math.random() * candyHues.length)];
                    if (hue !== 0) el.style.filter = `hue-rotate(${hue}deg)`;
                    state.particles.push({
                        el,
                        x: Math.random() * W,
                        y: Math.random() * H,
                        size,
                        speed: 0.12 + Math.random() * 0.2,
                        driftAmp: 8 + Math.random() * 10,
                        driftIdx: Math.floor(Math.random() * 360),
                        driftSpd: 1 + Math.floor(Math.random() * 2),
                        alpha: 0.7 + Math.random() * 0.3
                    });
                }
            },
            update(state, W, H, frame, makeEl, removeEl, posEl, sin) {
                // Candy falls
                state.particles.forEach(p => {
                    p.y += p.speed;
                    p.driftIdx = (p.driftIdx + p.driftSpd) % 360;
                    p.x += sin[p.driftIdx] * p.driftAmp * 0.012;
                    if (p.y > H + p.size) { p.y = -p.size * 2; p.x = Math.random() * W; }
                    posEl(p.el, p.x, p.y, p.alpha);
                });

                // Ghosts float side to side
                state._ghostTimer++;
                const activeGhosts = state._ghosts.filter(s => s.state !== 'done');
                if (state._ghostTimer >= state._ghostInterval && activeGhosts.length === 0) {
                    state._ghostTimer = 0;
                    const usableH = H * 0.5;
                    const topMargin = H * 0.15;
                    const zoneH = usableH / GHOST_COUNT;
                    for (let i = 0; i < GHOST_COUNT; i++) {
                        const fromLeft = Math.random() > 0.5;
                        const startX = fromLeft ? -55 : W + 55;
                        const baseY = topMargin + zoneH * i + Math.random() * (zoneH * 0.6);
                        state._ghosts.push({
                            el: makeEl('👻', 30),
                            x: startX,
                            y: baseY,
                            baseY,
                            speed: 0.5 + Math.random() * 0.3,
                            state: 'wait',
                            alpha: 0.8,
                            wait: i * 45 + 15 + Math.floor(Math.random() * 45),
                            floatIdx: Math.floor(Math.random() * 360),
                            floatSpd: 1 + Math.floor(Math.random() * 2),
                            floatAmp: 12 + Math.random() * 8,
                            fromLeft
                        });
                    }
                }

                for (let i = state._ghosts.length - 1; i >= 0; i--) {
                    const s = state._ghosts[i];
                    switch (s.state) {
                        case 'wait':
                            s.wait--;
                            if (s.wait <= 0) s.state = 'float';
                            posEl(s.el, s.x, s.y, 0);
                            break;
                        case 'float':
                            s.x += s.fromLeft ? s.speed : -s.speed;
                            s.floatIdx = (s.floatIdx + s.floatSpd) % 360;
                            s.y = s.baseY + sin[s.floatIdx] * s.floatAmp;
                            const reached = s.fromLeft ? s.x > W + 55 : s.x < -55;
                            if (reached) s.state = 'fade';
                            posEl(s.el, s.x, s.y, s.alpha);
                            break;
                        case 'fade':
                            s.alpha -= 0.01;
                            if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                            else posEl(s.el, s.x, s.y, s.alpha);
                            break;
                        case 'done': break;
                    }
                }
                state._ghosts = state._ghosts.filter(s => s.state !== 'done');

                // Pumpkins pop up from bottom
                if (frame % 2 === 0) {
                    state._pumpkinTimer++;
                    const activePumpkins = state._pumpkins.filter(s => s.state !== 'done');
                    if (state._pumpkinTimer >= state._pumpkinInterval && activePumpkins.length === 0) {
                        state._pumpkinTimer = 0;
                        const groundY = H - 40;
                        const spacing = W / (PUMPKIN_COUNT + 1);
                        for (let i = 0; i < PUMPKIN_COUNT; i++) {
                            state._pumpkins.push({
                                el: makeEl('🎃', 32),
                                x: spacing * (i + 1) + Math.random() * 40 - 20,
                                y: H + 40,
                                vy: 0,
                                groundY,
                                state: 'wait',
                                alpha: 1,
                                bounces: 0,
                                wait: i * 30 + Math.floor(Math.random() * 40)
                            });
                        }
                    }

                    for (let i = state._pumpkins.length - 1; i >= 0; i--) {
                        const s = state._pumpkins[i];
                        switch (s.state) {
                            case 'wait':
                                s.wait--;
                                if (s.wait <= 0) { s.state = 'rise'; s.vy = -3; }
                                posEl(s.el, s.x, s.y, 0);
                                break;
                            case 'rise':
                                s.vy += 0.15;
                                s.y += s.vy;
                                if (s.y >= s.groundY) {
                                    s.y = s.groundY;
                                    s.bounces++;
                                    s.state = s.bounces >= 1 ? 'fade' : 'rise';
                                    s.vy = s.bounces >= 1 ? 0 : -3 * 0.3;
                                }
                                posEl(s.el, s.x, s.y, 1);
                                break;
                            case 'fade':
                                s.alpha -= 0.005;
                                if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                                else posEl(s.el, s.x, s.y, s.alpha);
                                break;
                            case 'done': break;
                        }
                    }
                    state._pumpkins = state._pumpkins.filter(s => s.state !== 'done');
                }

                // Spiders appear/disappear at random spots
                if (frame % 3 === 0) {
                    state._spiderTimer++;
                    const activeSpiders = state._spiders.filter(s => s.state !== 'done');
                    if (state._spiderTimer >= state._spiderInterval && activeSpiders.length < MAX_SPIDERS) {
                        state._spiderTimer = 0;
                        state._spiders.push({
                            el: makeEl('🕷️', 26),
                            x: 50 + Math.random() * (W - 100),
                            y: 50 + Math.random() * (H - 100),
                            state: 'wait',
                            alpha: 0,
                            wait: Math.floor(Math.random() * 30),
                            visibleTimer: 90 + Math.floor(Math.random() * 60)
                        });
                    }

                    for (let i = state._spiders.length - 1; i >= 0; i--) {
                        const s = state._spiders[i];
                        switch (s.state) {
                            case 'wait':
                                s.wait--;
                                if (s.wait <= 0) s.state = 'appear';
                                posEl(s.el, s.x, s.y, 0);
                                break;
                            case 'appear':
                                s.alpha = Math.min(1, s.alpha + 0.012);
                                if (s.alpha >= 1) s.state = 'visible';
                                posEl(s.el, s.x, s.y, s.alpha);
                                break;
                            case 'visible':
                                s.visibleTimer--;
                                if (s.visibleTimer <= 0) s.state = 'disappear';
                                posEl(s.el, s.x, s.y, 1);
                                break;
                            case 'disappear':
                                s.alpha -= 0.008;
                                if (s.alpha <= 0) { s.state = 'done'; removeEl(s.el); }
                                else posEl(s.el, s.x, s.y, s.alpha);
                                break;
                            case 'done': break;
                        }
                    }
                    state._spiders = state._spiders.filter(s => s.state !== 'done');
                }
            }
        };
    },

    // Tracks how many overlay history entries Moonfin has pushed onto the stack.
    // Used to clean up orphaned entries when overlays are closed via navigation
    // rather than via the back button.
    _overlayHistoryDepth: 0,

    setupGlobalListeners() {
        var plugin = this;

        // Centralized back button handler — uses capture phase so it fires
        // before Jellyfin's router, preventing a "double back" where the
        // overlay closes AND the page navigates backward simultaneously.
        window.addEventListener('popstate', function(e) {
            // If state still has moonfinDetails, a Jellyfin dialog just closed
            // (dialogHelper pushes/pops its own history entry) — don't close our overlay
            var state = e.state || history.state || {};
            if (Details.isVisible) {
                if (state.moonfinDetails) return;
                e.stopImmediatePropagation();
                plugin._overlayHistoryDepth = Math.max(0, plugin._overlayHistoryDepth - 1);
                Details.hide(true);
            } else if (Settings.isOpen) {
                e.stopImmediatePropagation();
                plugin._overlayHistoryDepth = Math.max(0, plugin._overlayHistoryDepth - 1);
                Settings.hide(true);
            } else if (Jellyseerr.isOpen) {
                e.stopImmediatePropagation();
                plugin._overlayHistoryDepth = Math.max(0, plugin._overlayHistoryDepth - 1);
                Jellyseerr.close(true);
                Navbar.updateJellyseerrButtonState();
            } else if (Library.isVisible) {
                e.stopImmediatePropagation();
                plugin._overlayHistoryDepth = Math.max(0, plugin._overlayHistoryDepth - 1);
                Library.close();
            } else if (Genres.isVisible) {
                e.stopImmediatePropagation();
                if (Genres.currentView === 'browse') {
                    Genres.showGrid();
                    history.pushState({ moonfinGenres: true }, '');
                    plugin._overlayHistoryDepth++;
                } else {
                    plugin._overlayHistoryDepth = Math.max(0, plugin._overlayHistoryDepth - 1);
                    Genres.close();
                }
            } else if (SyncPlay.isOpen) {
                e.stopImmediatePropagation();
                plugin._overlayHistoryDepth = Math.max(0, plugin._overlayHistoryDepth - 1);
                SyncPlay.close(true);
            } else {
                // No overlay is open — check if this is an orphaned moonfin
                // state entry left over from an overlay that was closed via
                // navigation instead of the back button. Skip past it so the
                // user doesn't hit a phantom "dead" back press.
                var isMoonfinState = state.moonfinDetails || state.moonfinSettings ||
                                     state.moonfinJellyseerr || state.moonfinLibrary ||
                                     state.moonfinGenres || state.moonfinSyncPlay;
                if (isMoonfinState) {
                    e.stopImmediatePropagation();
                    history.back();
                    return;
                }
            }
        }, true);

        window.addEventListener('viewshow', () => {
            this.onPageChange();
        });
        
        window.addEventListener('hashchange', () => {
            this.onPageChange();
        });

        this.setupDOMObserver();

        window.addEventListener('moonfin-settings-preview', (e) => {
            var previewSettings = Object.assign({}, e.detail, {
                mediaBarEnabled: this.shouldUseMoonfinMediaBar(e.detail)
            });
            this.applyParadoxMediaBarSuppression(e.detail);
            if (Navbar.initialized) Navbar.applySettings(e.detail);
            if (Sidebar.initialized) Sidebar.applySettings(e.detail);
            MediaBar.applySettings(previewSettings);
        });

        window.addEventListener('moonfin-settings-changed', (e) => {
            console.log('[Moonfin] Settings changed');

            var navEnabled = e.detail.navbarEnabled;
            var navPosition = e.detail.navbarPosition || 'top';

            if (navEnabled) {
                if (navPosition === 'left') {
                    if (Navbar.initialized) Navbar.destroy();
                    if (!Sidebar.initialized) {
                        Sidebar.init();
                        if (Jellyseerr.config) Sidebar.updateJellyseerrButton(Jellyseerr.config);
                    }
                } else {
                    if (Sidebar.initialized) Sidebar.destroy();
                    if (!Navbar.initialized) {
                        Navbar.init();
                        if (Jellyseerr.config) Navbar.updateJellyseerrButton(Jellyseerr.config);
                    }
                }
            } else {
                if (Navbar.initialized) Navbar.destroy();
                if (Sidebar.initialized) Sidebar.destroy();
            }

            this.applyParadoxMediaBarSuppression(e.detail);

            var moonfinMediaBarEnabled = this.shouldUseMoonfinMediaBar(e.detail);
            if (moonfinMediaBarEnabled && !MediaBar.initialized) {
                MediaBar.init();
            } else if (!moonfinMediaBarEnabled && MediaBar.initialized) {
                MediaBar.destroy();
            }
        });
    },

    onPageChange() {
        var hadOverlay = false;

        if (Details.isVisible) {
            Details.hide(true);
            hadOverlay = true;
        }

        if (Jellyseerr.isOpen) {
            Jellyseerr.close(true);
            if (Navbar.initialized) Navbar.updateJellyseerrButtonState();
            if (Sidebar.initialized) Sidebar.updateJellyseerrButtonState();
            hadOverlay = true;
        }

        if (Genres.isVisible) {
            Genres.close();
            hadOverlay = true;
        }

        if (Library.isVisible) {
            Library.close();
            hadOverlay = true;
        }

        if (Settings.isOpen) {
            Settings.hide(true);
            hadOverlay = true;
        }

        // Reset depth counter — orphaned entries will be skipped
        // automatically by the popstate handler when the user presses back
        if (hadOverlay) {
            this._overlayHistoryDepth = 0;
        }

        if (this._tryOpenLibraryFromHash()) return;

        if (this.isAdminPage()) {
            if (Navbar.container) Navbar.container.classList.add('hidden');
            if (Sidebar.container) Sidebar.container.classList.add('hidden');
            if (Sidebar.mobileTrigger) Sidebar.mobileTrigger.classList.add('hidden');
            if (MediaBar.container) MediaBar.container.classList.add('hidden');
            MediaBar.stopAutoAdvance();
            MediaBar.stopTrailer();
            document.querySelectorAll('.moonfin-seasonal-effect').forEach(el => el.style.display = 'none');
            document.body.classList.remove('moonfin-navbar-active');
            document.body.classList.remove('moonfin-sidebar-active');
            document.body.classList.remove('moonfin-mediabar-active');
            return;
        }

        var hash = window.location.hash || '';
        if (hash.includes('#/video')) {
            if (Navbar.container) Navbar.container.classList.add('hidden');
            if (Sidebar.container) Sidebar.container.classList.add('hidden');
            if (Sidebar.mobileTrigger) Sidebar.mobileTrigger.classList.add('hidden');
            if (MediaBar.container) MediaBar.container.classList.add('hidden');
            MediaBar.stopAutoAdvance();
            MediaBar.stopTrailer();
            document.body.classList.remove('moonfin-navbar-active');
            document.body.classList.remove('moonfin-sidebar-active');
            document.body.classList.remove('moonfin-mediabar-active');
            return;
        }

        if (!this.initialized) {
            this.init();
            return;
        }

        if (this.checkUserChanged()) return;

        var currentSettings = Storage.getAll();
        this.applyParadoxMediaBarSuppression(currentSettings);
        var moonfinMediaBarEnabled = this.shouldUseMoonfinMediaBar(currentSettings);

        if (!moonfinMediaBarEnabled && MediaBar.initialized) {
            MediaBar.destroy();
        }

        if (Navbar.container) {
            var navbarEnabled = Storage.get('navbarEnabled') && Storage.get('navbarPosition') !== 'left';
            Navbar.container.classList.toggle('hidden', !navbarEnabled);
            document.body.classList.toggle('moonfin-navbar-active', !!navbarEnabled);
        }

        if (Sidebar.container) {
            var sidebarEnabled = Storage.get('navbarEnabled') && Storage.get('navbarPosition') === 'left';
            Sidebar.container.classList.toggle('hidden', !sidebarEnabled);
            if (Sidebar.mobileTrigger) Sidebar.mobileTrigger.classList.toggle('hidden', !sidebarEnabled);
            document.body.classList.toggle('moonfin-sidebar-active', !!sidebarEnabled);
        }

        document.querySelectorAll('.moonfin-seasonal-effect').forEach(el => el.style.display = '');

        if (moonfinMediaBarEnabled && MediaBar.initialized && MediaBar.container) {
            MediaBar.ensureInDOM();

            var showMediaBar = this.isHomePage();
            MediaBar.container.classList.toggle('hidden', !showMediaBar);
            if (showMediaBar) {
                if (MediaBar.items && MediaBar.items.length > 0) {
                    document.body.classList.add('moonfin-mediabar-active');
                    if (!MediaBar.isPaused && !MediaBar.autoAdvanceTimer) {
                        MediaBar.startAutoAdvance();
                    }
                }
            } else {
                document.body.classList.remove('moonfin-mediabar-active');
                MediaBar.stopAutoAdvance();
                MediaBar.stopTrailer();
            }
        } else {
            document.body.classList.remove('moonfin-mediabar-active');
        }

        Navbar.updateActiveState();
        if (Sidebar.initialized) Sidebar.updateActiveState();

        if ((window.location.hash || '').toLowerCase().includes('mypreferencesmenu')) {
            var self = this;
            var attempts = 0;
            var tryInject = function() {
                self.addUserPreferencesLink();
                attempts++;
                if (attempts < 5 && !document.querySelector('.moonfin-prefs-link')) {
                    setTimeout(tryInject, 300);
                }
            };
            tryInject();
        }
    },

    addUserPreferencesLink() {
        var prefsPage = document.querySelector('#myPreferencesMenuPage:not(.hide)') ||
                        document.querySelector('.myPreferencesMenuPage:not(.hide)') ||
                        document.querySelector('[data-page="mypreferencesmenu"]:not(.hide)');

        if (!prefsPage) {
            var pages = document.querySelectorAll('.page:not(.hide)');
            for (var p = 0; p < pages.length; p++) {
                if (pages[p].querySelector('.listItem-border, .listItem')) {
                    var hash = (window.location.hash || '').toLowerCase();
                    if (hash.includes('mypreferencesmenu')) {
                        prefsPage = pages[p];
                        break;
                    }
                }
            }
        }

        if (!prefsPage) return;
        if (prefsPage.querySelector('.moonfin-prefs-link')) return;

        var menuItems = prefsPage.querySelectorAll('.listItem-border');
        if (menuItems.length === 0) {
            menuItems = prefsPage.querySelectorAll('.listItem');
        }
        if (menuItems.length === 0) return;

        var insertAfter = null;
        for (var i = 0; i < menuItems.length; i++) {
            var text = (menuItems[i].textContent || '').trim().toLowerCase();
            if (text.includes('control')) {
                insertAfter = menuItems[i];
                break;
            }
        }
        if (!insertAfter && menuItems.length >= 2) {
            insertAfter = menuItems[menuItems.length - 2];
        }
        if (!insertAfter) {
            insertAfter = menuItems[menuItems.length - 1];
        }
        while (insertAfter.parentNode && insertAfter.parentNode !== prefsPage && !insertAfter.parentNode.querySelector('.listItem-border, .listItem')) {
            insertAfter = insertAfter.parentNode;
        }
        if (!insertAfter || !insertAfter.parentNode) return;

        var link = document.createElement('a');
        link.className = 'listItem-border moonfin-prefs-link';
        link.href = '#';
        link.style.cssText = 'display:block;margin:0;padding:0;text-decoration:none;color:inherit;';
        link.innerHTML =
            '<div class="listItem" style="cursor:pointer">' +
                '<span class="material-icons listItemIcon listItemIcon-transparent settings" aria-hidden="true"></span>' +
                '<div class="listItemBody">' +
                    '<div class="listItemBodyText">Moonfin</div>' +
                '</div>' +
            '</div>';

        link.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            Settings.show();
        });

        insertAfter.parentNode.insertBefore(link, insertAfter.nextSibling);
    },

    setupDOMObserver() {
        if (this._domObserver) return;

        var self = this;
        var throttleTimer = null;

        this._domObserver = new MutationObserver(function() {
            if (throttleTimer) return;
            throttleTimer = setTimeout(function() {
                throttleTimer = null;
                var hash = window.location.hash.toLowerCase();
                if (hash.includes('mypreferencesmenu')) {
                    self.addUserPreferencesLink();
                }
            }, 200);
        });

        this._domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    },

    _getLoggedInUserId() {
        try {
            var api = window.ApiClient || (window.connectionManager && window.connectionManager.currentApiClient());
            return api?.getCurrentUserId?.() || null;
        } catch (e) {
            return null;
        }
    },

    checkUserChanged() {
        var newUserId = this._getLoggedInUserId();
        if (!newUserId || !this._currentUserId) return false;
        if (newUserId === this._currentUserId) return false;

        this.resetForNewUser();
        return true;
    },

    resetForNewUser() {
        console.log('[Moonfin] User changed, resetting plugin session...');

        if (Navbar.initialized) Navbar.destroy();
        if (Sidebar.initialized) Sidebar.destroy();
        if (MediaBar.initialized) MediaBar.destroy();
        Jellyseerr.destroy();
        Jellyseerr.ssoStatus = null;
        Jellyseerr.config = null;
        if (Details.isVisible) Details.hide(true);
        if (Details.container) { Details.container.remove(); Details.container = null; }
        if (Genres.isVisible) Genres.close();
        if (Library.isVisible) Library.close();
        if (Settings.isOpen) Settings.hide(true);
        document.querySelectorAll('.moonfin-seasonal-effect').forEach(el => el.remove());
        if (this._seasonalState) { this._seasonalState.stop(); this._seasonalState = null; }

        Storage.resetForNewUser();

        this._currentUserId = null;
        this._overlayHistoryDepth = 0;
        this.initialized = false;
        this._initializing = false;

        this.init();
    },

    destroy() {
        Navbar.destroy();
        MediaBar.destroy();
        Jellyseerr.destroy();
        document.querySelectorAll('.moonfin-seasonal-effect').forEach(el => el.remove());
        this.initialized = false;
        this._currentUserId = null;
        console.log('[Moonfin] Plugin destroyed');
    }
};

(function() {
    if (typeof window !== 'undefined') {
        const isUserLoggedIn = () => {
            try {
                const api = window.ApiClient || (window.connectionManager && window.connectionManager.currentApiClient());
                if (!api) return false;

                // Prefer stable public methods over private internals that may change across Jellyfin releases.
                if (typeof api.isLoggedIn === 'function') {
                    return !!api.isLoggedIn();
                }

                const userId = typeof api.getCurrentUserId === 'function'
                    ? api.getCurrentUserId()
                    : (api._currentUser && api._currentUser.Id);

                const token = typeof api.accessToken === 'function'
                    ? api.accessToken()
                    : (api._serverInfo && api._serverInfo.AccessToken);

                return !!(userId && token);
            } catch (e) {
                return false;
            }
        };
        
        const initWhenReady = () => {
            const hash = window.location.hash.toLowerCase();
            if (hash.includes('login') || hash.includes('selectserver') || hash.includes('startup')) {
                setTimeout(initWhenReady, 1000);
                return;
            }
            
            if (isUserLoggedIn()) {
                console.log('[Moonfin] User authenticated, initializing...');
                Plugin.init();
            } else {
                setTimeout(initWhenReady, 500);
            }
        };

        if (document.readyState === 'complete') {
            setTimeout(initWhenReady, 100);
        } else {
            window.addEventListener('load', () => setTimeout(initWhenReady, 100));
        }
        
        window.addEventListener('hashchange', () => {
            if (isUserLoggedIn()) {
                if (Plugin.initialized) {
                    Plugin.checkUserChanged();
                } else {
                    Plugin.init();
                }
            }
        });
    }

    window.Moonfin = {
        Plugin,
        TVNavigation,
        Device,
        Storage,
        Settings,
        Navbar,
        MediaBar,
        Jellyseerr,
        Details,
        API
    };
})();



})();
