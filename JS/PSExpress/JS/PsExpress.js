// =============================================
// Adobe Creative Cloud 授权修复脚本 for Loon
// 修复 lcs-mobile-cops.adobe.io 的过期授权响应
// 处理 Base64 编码的 payload
// =============================================

(function() {
    'use strict';
    
    // 检查是否为目标响应
    if ($response.status !== 200) return;
    if (!$response.body) return;
    
    try {
        let body = JSON.parse($response.body);
        
        // 检查是否存在 asnp.payload
        if (body.asnp && body.asnp.payload) {
            console.log("🔧 检测到 Base64 编码的 Adobe 授权响应，开始修复...");
            
            // 解码 payload
            const decodedPayload = base64Decode(body.asnp.payload);
            if (decodedPayload) {
                const payloadObj = JSON.parse(decodedPayload);
                
                // 检测是否为过期的授权响应
                if (payloadObj.profileStatus === "PROFILE_EXPIRED" || 
                    (payloadObj.controlProfile && payloadObj.controlProfile.validUptoTimestamp < Math.floor(Date.now() / 1000))) {
                    
                    console.log("🔄 检测到过期授权，修复中...");
                    
                    // 修复授权数据
                    const repairedPayload = repairAdobeLicense(payloadObj);
                    
                    // 重新编码为 Base64
                    body.asnp.payload = base64Encode(JSON.stringify(repairedPayload));
                    
                    console.log("✅ Adobe授权修复完成");
                    console.log("🎯 授权状态: " + repairedPayload.profileStatus);
                    console.log("⏰ 过期时间: 2030-01-01");
                } else {
                    console.log("ℹ️ 授权状态正常，无需修复");
                }
            }
            
            // 更新响应体
            $response.body = JSON.stringify(body);
        }
        
    } catch (error) {
        console.log("❌ 修复脚本执行错误: " + error.message);
    }
    
    $done({});
})();

// =============================================
// Adobe 授权修复核心函数
// =============================================
function repairAdobeLicense(originalBody) {
    const currentTime = Math.floor(Date.now() / 1000);
    const expireTime = 1893452800; // 2030-01-01 00:00:00
    
    // 修复核心授权状态
    originalBody.profileStatus = "PROFILE_AVAILABLE";
    originalBody.profileStatusReason = 1000;
    originalBody.profileStatusReasonText = "Profile Available due to an acquired plan provisioned and ACTIVE";
    originalBody.appLicenseMode = "FREEMIUM";
    
    // 修复可访问项目
    if (originalBody.appProfile && originalBody.appProfile.accessibleItems) {
        originalBody.appProfile.accessibleItems.forEach(item => {
            if (item.source) {
                item.source.type = "LICENSE";
                item.source.status_reason = "NORMAL";
                item.source.can_access_until = expireTime;
            }
            if (item.fulfillable_items) {
                item.fulfillable_items = repairFulfillableItems(item.fulfillable_items);
            }
        });
    }
    
    // 修复控制配置文件的时间戳
    if (originalBody.controlProfile) {
        originalBody.controlProfile.validUptoTimestamp = expireTime;
        originalBody.controlProfile.cacheLifetime = 39970872755;
        
        // 修复缓存过期警告时间
        if (originalBody.controlProfile.cacheExpiryWarningControl) {
            originalBody.controlProfile.cacheExpiryWarningControl.warningStartTimestamp = 1890831600000; // 2029-12-01
        }
    }
    
    // 修复传统配置文件
    if (originalBody.legacyProfile && typeof originalBody.legacyProfile === "string") {
        try {
            const legacyObj = JSON.parse(originalBody.legacyProfile);
            legacyObj.effectiveEndTimestamp = expireTime;
            legacyObj.enigmaData.productId = 204;
            legacyObj.enigmaData.isk = 2044017;
            legacyObj.enigmaData.rb = false;
            originalBody.legacyProfile = JSON.stringify(legacyObj);
        } catch (e) {
            console.log("⚠️ 传统配置文件解析失败，使用默认修复");
            originalBody.legacyProfile = JSON.stringify({
                "licenseId": generateLicenseId(),
                "licenseType": 3,
                "licenseVersion": "1.0",
                "effectiveEndTimestamp": expireTime,
                "graceTime": 0,
                "licensedFeatures": [],
                "enigmaData": {
                    "productId": 204,
                    "serialKey": generateSerialKey(),
                    "clearSerialKey": generateClearSerialKey(),
                    "locale": "ALL",
                    "associatedLocales": "ALL",
                    "platform": 0,
                    "isk": 2044017,
                    "customerId": 0,
                    "deliveryMethod": 3,
                    "pc": true,
                    "rb": false
                }
            });
        }
    }
    
    return originalBody;
}

// =============================================
// 功能项修复
// =============================================
function repairFulfillableItems(originalItems) {
    const baseItems = {
        "cc_storage": {
            "enabled": true,
            "feature_sets": {
                "CS_LVL_2": {
                    "id": "CS_LVL_2",
                    "label": "CS LVL 2",
                    "enabled": true
                },
                "VRT_30": {
                    "id": "VRT_30", 
                    "label": "VRT 30",
                    "enabled": true
                }
            },
            "charging_model": {
                "cap": 100,
                "unit": "GB",
                "model": "RECURRING",
                "overage": "NA",
                "rollover": 0
            }
        },
        "photoshop_express": {
            "enabled": true,
            "charging_model": {
                "model": "RECURRING",
                "overage": "NA",
                "rollover": 0
            }
        },
        "photoshop_express_feature_access": {
            "enabled": true,
            "charging_model": {
                "model": "RECURRING", 
                "overage": "NA",
                "rollover": 0
            }
        },
        "core_services_cc": {
            "enabled": true,
            "feature_sets": {
                "CS_LVL_2": {
                    "id": "CS_LVL_2",
                    "label": "CS LVL 2",
                    "enabled": true
                }
            },
            "charging_model": {
                "model": "RECURRING",
                "overage": "NA",
                "rollover": 0
            }
        }
    };
    
    // 合并原有项目和修复项目
    return Object.assign({}, baseItems, originalItems);
}

// =============================================
// Base64 编解码函数
// =============================================
function base64Decode(input) {
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let str = String(input).replace(/=+$/, '');
        let binaryStr = '';

        if (str.length % 4 === 1) {
            throw new Error('Invalid base64 string');
        }

        for (
            let bc = 0, bs, buffer, idx = 0; buffer = str.charAt(idx++); ~buffer &&
            (bs = bc % 4 ? bs * 64 + buffer : buffer,
                bc++ % 4) ? binaryStr += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
        ) {
            buffer = chars.indexOf(buffer);
        }

        return binaryStr;
    } catch (e) {
        console.log(`Base64 Decode Error: ${e.message}`);
        return null;
    }
}

function base64Encode(input) {
    try {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        let str = String(input);
        let output = '';

        for (
            let block, charCode, idx = 0, map = chars;
            str.charAt(idx | 0) || (map = '=', idx % 1);
            output += map.charAt(63 & block >> 8 - idx % 1 * 8)
        ) {
            charCode = str.charCodeAt(idx += 3 / 4);

            if (charCode > 0xFF) {
                throw new Error("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
            }

            block = block << 8 | charCode;
        }

        return output;
    } catch (e) {
        console.log(`Base64 Encode Error: ${e.message}`);
        return null;
    }
}

// =============================================
// 辅助函数
// =============================================

// 生成许可证 ID
function generateLicenseId() {
    return Math.random().toString(36).substr(2, 16).toUpperCase();
}

// 生成序列号
function generateSerialKey() {
    let key = '';
    for (let i = 0; i < 24; i++) {
        key += Math.floor(Math.random() * 10);
    }
    return key;
}

// 生成清除序列号
function generateClearSerialKey() {
    let key = '';
    for (let i = 0; i < 20; i++) {
        key += Math.floor(Math.random() * 10);
    }
    return key;
}
