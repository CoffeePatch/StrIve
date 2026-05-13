"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listsExport = void 0;
const functions = __importStar(require("firebase-functions"));
const csv_1 = require("../../utils/csv");
const net_1 = require("../../utils/net");
const enrichment_1 = require("../../services/enrichment");
const common_1 = require("./common");
exports.listsExport = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const listId = (0, common_1.extractListIdFromPath)(req.path, 'export');
        const authHeader = req.headers.authorization || req.headers.Authorization;
        const uid = await (0, common_1.requireUidFromAuthHeader)(authHeader);
        const { itemsCollectionRef, listName } = await (0, common_1.resolveListExportContext)(uid, listId);
        const itemsSnapshot = await itemsCollectionRef.get();
        if (!itemsSnapshot || itemsSnapshot.empty) {
            res.set('Cache-Control', 'no-cache');
            res.status(204).end();
            return;
        }
        const tmdbApiKey = process.env.TMDB_API_KEY;
        const limit = (0, net_1.pLimit)(8);
        const enriched = await Promise.all(itemsSnapshot.docs
            .map((d) => d.data())
            .map((item) => limit(() => (0, enrichment_1.enrichItem)(item, tmdbApiKey))));
        const header = 'tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes';
        const rows = enriched.map((r) => {
            var _a;
            return [
                (0, csv_1.escapeCsvField)(String((_a = r.tmdbId) !== null && _a !== void 0 ? _a : '')),
                (0, csv_1.escapeCsvField)(r.imdbId || ''),
                (0, csv_1.escapeCsvField)(r.name || ''),
                (0, csv_1.escapeCsvField)(r.year || ''),
                (0, csv_1.escapeCsvField)(r.mediaType || ''),
                (0, csv_1.escapeCsvField)(r.tmdbRating || ''),
                (0, csv_1.escapeCsvField)(r.imdbRating || ''),
                (0, csv_1.escapeCsvField)(r.tmdbVotes || ''),
                (0, csv_1.escapeCsvField)(r.imdbVotes || ''),
            ].join(',');
        });
        const csv = [header, ...rows].join('\n');
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = String(now.getUTCMonth() + 1).padStart(2, '0');
        const d = String(now.getUTCDate()).padStart(2, '0');
        const dateStr = `${y}${m}${d}`;
        const safeName = listName.replace(/[\n\r]/g, ' ').trim();
        const filename = `${safeName}-${dateStr}.csv`;
        res.set('Content-Type', 'text/csv');
        res.set('Content-Disposition', `attachment; filename="${filename}"`);
        res.set('Cache-Control', 'no-cache');
        res.status(200).send(csv);
    }
    catch (error) {
        if (error instanceof common_1.HttpRequestError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error('Error exporting list CSV:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=listsExport.js.map