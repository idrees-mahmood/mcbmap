/**
 * IndexedDB Cache for Business Nodes
 * ===================================
 * Uses IndexedDB instead of localStorage for larger storage capacity.
 * localStorage has ~5MB limit, IndexedDB can store 100MB+.
 */

const DB_NAME = 'mcbmap_cache'
const DB_VERSION = 1
const STORE_NAME = 'business_nodes'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

interface CachedData {
    id: string
    timestamp: number
    nodes: import('./businessCounter').BusinessNode[]
}

let dbPromise: Promise<IDBDatabase> | null = null

/**
 * Open (or create) the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
    if (dbPromise) return dbPromise

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION)

        request.onerror = () => {
            console.error('[IndexedDB] Failed to open database:', request.error)
            reject(request.error)
        }

        request.onsuccess = () => {
            resolve(request.result)
        }

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' })
                console.log('[IndexedDB] Created object store:', STORE_NAME)
            }
        }
    })

    return dbPromise
}

/**
 * Load cached business nodes from IndexedDB
 */
export async function loadFromIndexedDB(): Promise<import('./businessCounter').BusinessNode[] | null> {
    try {
        const db = await openDB()

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly')
            const store = transaction.objectStore(STORE_NAME)
            const request = store.get('business_nodes_cache')

            request.onsuccess = () => {
                const data = request.result as CachedData | undefined

                if (!data) {
                    console.log('[IndexedDB] No cached data found')
                    resolve(null)
                    return
                }

                // Check freshness
                const age = Date.now() - data.timestamp
                if (age > CACHE_TTL_MS) {
                    console.log('[IndexedDB] Cache expired, clearing')
                    clearIndexedDBCache()
                    resolve(null)
                    return
                }

                console.log(`[IndexedDB] Loaded ${data.nodes.length} nodes (age: ${Math.round(age / 60000)}min)`)
                resolve(data.nodes)
            }

            request.onerror = () => {
                console.error('[IndexedDB] Error loading cache:', request.error)
                resolve(null)
            }
        })
    } catch (e) {
        console.warn('[IndexedDB] Could not load cache:', e)
        return null
    }
}

/**
 * Save business nodes to IndexedDB
 */
export async function saveToIndexedDB(nodes: import('./businessCounter').BusinessNode[]): Promise<void> {
    try {
        const db = await openDB()

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)

            const data: CachedData = {
                id: 'business_nodes_cache',
                timestamp: Date.now(),
                nodes
            }

            const request = store.put(data)

            request.onsuccess = () => {
                console.log(`[IndexedDB] Saved ${nodes.length} nodes to cache`)
                resolve()
            }

            request.onerror = () => {
                console.error('[IndexedDB] Error saving cache:', request.error)
                reject(request.error)
            }
        })
    } catch (e) {
        console.warn('[IndexedDB] Could not save cache:', e)
    }
}

/**
 * Clear the IndexedDB cache
 */
export async function clearIndexedDBCache(): Promise<void> {
    try {
        const db = await openDB()

        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite')
            const store = transaction.objectStore(STORE_NAME)
            store.delete('business_nodes_cache')

            transaction.oncomplete = () => {
                console.log('[IndexedDB] Cache cleared')
                resolve()
            }
        })
    } catch (e) {
        console.warn('[IndexedDB] Could not clear cache:', e)
    }
}
