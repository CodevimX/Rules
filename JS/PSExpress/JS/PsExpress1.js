// =============================================
// Adobe Creative Cloud 授权修复脚本 - 优化版
// 重点优化执行效率和资源占用
// =============================================

(function() {
    'use strict';
    
    // 快速检查 - 尽早返回
    if ($response.status !== 200 || !$response.body) return;
    
    const url = $request.url;
    if (!url.includes('lcs-mobile-cops.adobe.io')) return;
    
    try {
        const body = JSON.parse($response.body);
        
        // 快速检查关键字段
        if (!body.asnp?.payload) return;
        
        const payload = decodeAndRepair(body.asnp.payload);
        if (payload) {
            body.asnp.payload = payload;
            $done({ body: JSON.stringify(body) });
            return;
        }
    } catch (e) {
        // 静默失败，不影响其他功能
    }
    
    $done({});
})();

// 核心修复函数 - 最小化操作
function decodeAndRepair(encodedPayload) {
    try {
        const decoded = base64Decode(encodedPayload);
        const data = JSON.parse(decoded);
        
        // 快速检测是否需要修复
        if (data.profileStatus !== "PROFILE_EXPIRED" && data.profileStatusReason !== 2000) {
            return null;
        }
        
        // 一次性修复所有字段
        return base64Encode(JSON.stringify(quickRepair(data)));
    } catch (e) {
        return null;
    }
}

// 批量修复函数 - 减少循环和条件判断
function quickRepair(data) {
    const expireTime = 1893452800000; // 2030年
    
    // 核心状态修复
    Object.assign(data, {
        profileStatus: "PROFILE_AVAILABLE",
        profileStatusReason: 1000,
        profileStatusReasonText: "Profile Available due to an acquired plan provisioned and ACTIVE",
        appLicenseMode: "FREEMIUM"
    });
    
    // 修复可访问项目
    if (data.appProfile?.accessibleItems) {
        data.appProfile.accessibleItems.forEach(item => {
            if (item.source) {
                Object.assign(item.source, {
                    type: "LICENSE",
                    status_reason: "NORMAL",
                    can_access_until: expireTime
                });
            }
            // 简化功能修复
            if (item.fulfillable_items) {
                item.fulfillable_items = Object.assign(item.fulfillable_items, getFullFeatures());
            }
        });
    }
    
    // 修复控制配置
    if (data.controlProfile) {
        data.controlProfile.validUptoTimestamp = expireTime;
    }
    
    // 修复传统配置
    if (data.legacyProfile && typeof data.legacyProfile === "string") {
        try {
            const legacy = JSON.parse(data.legacyProfile);
            legacy.effectiveEndTimestamp = expireTime;
            legacy.enigmaData.productId = 204;
            legacy.enigmaData.isk = 2044017;
            legacy.enigmaData.rb = false;
            data.legacyProfile = JSON.stringify(legacy);
        } catch (e) {
            data.legacyProfile = JSON.stringify(createDefaultLegacy(expireTime));
        }
    }
    
    return data;
}

// 预定义功能配置 - 避免重复创建
function getFullFeatures() {
    return {
        "cc_storage": {
            "enabled": true,
            "feature_sets": {
                "CS_LVL_2": { "id": "CS_LVL_2", "label": "CS LVL 2", "enabled": true },
                "VRT_30": { "id": "VRT_30", "label": "VRT 30", "enabled": true }
            },
            "charging_model": { "cap": 100, "unit": "GB", "model": "RECURRING", "overage": "NA", "rollover": 0 }
        },
        "photoshop_express": {
            "enabled": true,
            "charging_model": { "model": "RECURRING", "overage": "NA", "rollover": 0 }
        },
        "photoshop_express_feature_access": {
            "enabled": true, 
            "charging_model": { "model": "RECURRING", "overage": "NA", "rollover": 0 }
        },
        "core_services_cc": {
            "enabled": true,
            "feature_sets": {
                "CS_LVL_2": { "id": "CS_LVL_2", "label": "CS LVL 2", "enabled": true }
            },
            "charging_model": { "model": "RECURRING", "overage": "NA", "rollover": 0 }
        }
    };
}

function createDefaultLegacy(expireTime) {
    return {
        "licenseId": Math.random().toString(36).substr(2, 16).toUpperCase(),
        "licenseType": 3,
        "licenseVersion": "1.0", 
        "effectiveEndTimestamp": expireTime,
        "graceTime": 0,
        "licensedFeatures": [],
        "enigmaData": {
            "productId": 204,
            "serialKey": Array(24).fill(0).map(() => Math.floor(Math.random() * 10)).join(''),
            "clearSerialKey": Array(20).fill(0).map(() => Math.floor(Math.random() * 10)).join(''),
            "locale": "ALL",
            "associatedLocales": "ALL", 
            "platform": 0,
            "isk": 2044017,
            "customerId": 0,
            "deliveryMethod": 3,
            "pc": true,
            "rb": false
        }
    };
}

// Base64 函数保持不变（已足够高效）
function base64Decode(input) {
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let str = String(input).replace(/=+$/, ''), binaryStr = '';
        if (str.length % 4 === 1) return null;
        for (let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer, bc++ % 4) ? binaryStr += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
            buffer = chars.indexOf(buffer);
        }
        return binaryStr;
    } catch (e) { return null; }
}

function base64Encode(input) {
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let str = String(input), output = '';
        for (let block, charCode, idx = 0, map = chars; str.charAt(idx | 0) || (map = '=', idx % 1); output += map.charAt(63 & block >> 8 - idx % 1 * 8)) {
            charCode = str.charCodeAt(idx += 3 / 4);
            if (charCode > 0xFF) return null;
            block = block << 8 | charCode;
        }
        return output;
    } catch (e) { return null; }
}
