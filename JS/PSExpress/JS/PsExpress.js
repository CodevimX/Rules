// =============================================
// Adobe Creative Cloud 授权修复脚本 for Loon
// 增强版 - 更宽松的 URL 匹配
// =============================================

(function() {
    'use strict';
    
    console.log("🔧 Adobe 授权修复脚本开始执行");
    console.log("📝 请求URL: " + $request.url);
    
    // 检查是否为目标域名
    if (!$request.url.includes('lcs-mobile-cops.adobe.io')) {
        console.log("❌ 非目标域名，跳过处理");
        return;
    }
    
    // 检查响应状态和内容
    if ($response.status !== 200) {
        console.log("❌ 响应状态码非200: " + $response.status);
        return;
    }
    
    if (!$response.body) {
        console.log("❌ 响应体为空");
        return;
    }
    
    try {
        let body = JSON.parse($response.body);
        console.log("✅ 响应体解析成功");
        
        // 检查是否存在 asnp.payload
        if (body.asnp && body.asnp.payload) {
            console.log("📦 检测到 Base64 编码的 payload");
            
            // 解码 payload
            const decodedPayload = base64Decode(body.asnp.payload);
            if (decodedPayload) {
                let payloadObj;
                try {
                    payloadObj = JSON.parse(decodedPayload);
                    console.log("✅ Payload 解码成功");
                    
                    // 记录原始状态
                    console.log("📊 原始状态: " + payloadObj.profileStatus);
                    console.log("📊 原始原因: " + payloadObj.profileStatusReason);
                    
                    // 检测是否为需要修复的授权响应
                    const needsRepair = 
                        payloadObj.profileStatus === "PROFILE_EXPIRED" || 
                        payloadObj.profileStatusReason === 2000;
                    
                    if (needsRepair) {
                        console.log("🔄 检测到需要修复的授权状态，开始修复...");
                        
                        // 修复授权数据
                        const repairedPayload = repairAdobeLicense(payloadObj);
                        
                        // 重新编码为 Base64
                        const newPayload = base64Encode(JSON.stringify(repairedPayload));
                        if (newPayload) {
                            body.asnp.payload = newPayload;
                            console.log("✅ Adobe授权修复完成");
                            console.log("🎯 新状态: " + repairedPayload.profileStatus);
                            console.log("⏰ 新过期时间: 2030-01-01");
                            
                            // 更新响应体
                            $done({ body: JSON.stringify(body) });
                            return;
                        } else {
                            console.log("❌ Base64 编码失败");
                        }
                    } else {
                        console.log("ℹ️ 授权状态正常，无需修复");
                    }
                } catch (parseError) {
                    console.log("❌ Payload JSON 解析错误: " + parseError.message);
                }
            } else {
                console.log("❌ Base64 解码失败");
            }
        } else {
            console.log("❌ 未找到 asnp.payload");
        }
        
    } catch (error) {
        console.log("❌ 脚本执行错误: " + error.message);
    }
    
    // 如果没有修改，保持原响应
    $done({});
})();

// =============================================
// 以下修复函数保持不变（与之前相同）
// =============================================
function repairAdobeLicense(originalBody) {
    const expireTimeMs = 1893452800000; // 2030-01-01 00:00:00 毫秒
    
    console.log("🔧 开始修复授权数据...");
    
    // 修复核心授权状态
    originalBody.profileStatus = "PROFILE_AVAILABLE";
    originalBody.profileStatusReason = 1000;
    originalBody.profileStatusReasonText = "Profile Available due to an acquired plan provisioned and ACTIVE";
    originalBody.appLicenseMode = "FREEMIUM";
    
    console.log("✅ 核心状态修复完成");
    
    // 修复可访问项目
    if (originalBody.appProfile && originalBody.appProfile.accessibleItems && originalBody.appProfile.accessibleItems.length > 0) {
        originalBody.appProfile.accessibleItems.forEach((item, index) => {
            if (item.source) {
                item.source.type = "LICENSE";
                item.source.status_reason = "NORMAL";
                item.source.can_access_until = expireTimeMs;
                console.log(`✅ 修复可访问项目 ${index} 完成`);
            }
            if (item.fulfillable_items) {
                item.fulfillable_items = repairFulfillableItems(item.fulfillable_items);
            }
        });
    }
    
    // 修复控制配置文件
    if (originalBody.controlProfile) {
        originalBody.controlProfile.validUptoTimestamp = expireTimeMs;
        originalBody.controlProfile.cacheLifetime = 39970872755;
        
        if (originalBody.controlProfile.cacheExpiryWarningControl) {
            originalBody.controlProfile.cacheExpiryWarningControl.warningStartTimestamp = expireTimeMs - (30 * 24 * 60 * 60 * 1000);
        }
        
        console.log("✅ 控制配置文件修复完成");
    }
    
    // 修复传统配置文件
    if (originalBody.legacyProfile && typeof originalBody.legacyProfile === "string") {
        try {
            const legacyObj = JSON.parse(originalBody.legacyProfile);
            legacyObj.effectiveEndTimestamp = expireTimeMs;
            legacyObj.enigmaData.productId = 204;
            legacyObj.enigmaData.isk = 2044017;
            legacyObj.enigmaData.rb = false;
            originalBody.legacyProfile = JSON.stringify(legacyObj);
            console.log("✅ 传统配置文件修复完成");
        } catch (e) {
            console.log("⚠️ 传统配置文件解析失败: " + e.message);
            originalBody.legacyProfile = JSON.stringify({
                "licenseId": generateLicenseId(),
                "licenseType": 3,
                "licenseVersion": "1.0",
                "effectiveEndTimestamp": expireTimeMs,
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
    
    console.log("🎉 授权修复全部完成");
    return originalBody;
}

function repairFulfillableItems(originalItems) {
    console.log("🔧 修复功能项...");
    
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
    
    const result = Object.assign({}, originalItems, baseItems);
    console.log("✅ 功能项修复完成");
    return result;
}

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
        console.log(`❌ Base64 解码错误: ${e.message}`);
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
        console.log(`❌ Base64 编码错误: ${e.message}`);
        return null;
    }
}

function generateLicenseId() {
    return Math.random().toString(36).substr(2, 16).toUpperCase();
}

function generateSerialKey() {
    let key = '';
    for (let i = 0; i < 24; i++) {
        key += Math.floor(Math.random() * 10);
    }
    return key;
}

function generateClearSerialKey() {
    let key = '';
    for (let i = 0; i < 20; i++) {
        key += Math.floor(Math.random() * 10);
    }
    return key;
}
