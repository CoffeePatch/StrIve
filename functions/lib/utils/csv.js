"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeCsvField = void 0;
function escapeCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    const fieldStr = String(field);
    if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
        return `"${fieldStr.replace(/"/g, '""')}"`;
    }
    return fieldStr;
}
exports.escapeCsvField = escapeCsvField;
//# sourceMappingURL=csv.js.map