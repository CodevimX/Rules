// =============================================
// Adobe Creative Cloud 授权修复脚本 for Loon
// 修复 lcs-mobile-cops.adobe.io 的过期授权响应
// =============================================

(function() {
    'use strict';
    
    // 检查是否为目标响应
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
        console.log("🔧 开始处理 Adobe 授权响应");
        
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
                        payloadObj.profileStatusReason === 2000 ||
                        (payloadObj.controlProfile && payloadObj.controlProfile.validUptoTimestamp < Math.floor(Date.now() / 1000));
                    
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
                            $response.body = JSON.stringify(body);
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
    
    $done({});
})();

// =============================================
// Adobe 授权修复核心函数
// =============================================
function repairAdobeLicense(originalBody) {
    const expireTimeMs = 1893452800000; // 2030-01-01 00:00:00 毫秒
    const expireTimeSec = 1893452800;   // 2030-01-01 00:00:00 秒
    
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
                item.source.can_access_until = expireTimeMs; // 毫秒时间戳
                console.log(`✅ 修复可访问项目 ${index} 完成`);
            }
            if (item.fulfillable_items) {
                item.fulfillable_items = repairFulfillableItems(item.fulfillable_items);
            }
        });
    }
    
    // 修复控制配置文件
    if (originalBody.controlProfile) {
        originalBody.controlProfile.validUptoTimestamp = expireTimeMs; // 毫秒时间戳
        originalBody.controlProfile.cacheLifetime = 39970872755;
        
        // 修复缓存过期警告时间
        if (originalBody.controlProfile.cacheExpiryWarningControl) {
            originalBody.controlProfile.cacheExpiryWarningControl.warningStartTimestamp = expireTimeMs - (30 * 24 * 60 * 60 * 1000); // 提前30天警告
        }
        
        console.log("✅ 控制配置文件修复完成");
    }
    
    // 修复传统配置文件
    if (originalBody.legacyProfile && typeof originalBody.legacyProfile === "string") {
        try {
            const legacyObj = JSON.parse(originalBody.legacyProfile);
            legacyObj.effectiveEndTimestamp = expireTimeMs; // 毫秒时间戳
            legacyObj.enigmaData.productId = 204;
            legacyObj.enigmaData.isk = 2044017;
            legacyObj.enigmaData.rb = false;
            originalBody.legacyProfile = JSON.stringify(legacyObj);
            console.log("✅ 传统配置文件修复完成");
        } catch (e) {
            console.log("⚠️ 传统配置文件解析失败: " + e.message);
            // 创建新的传统配置文件
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

// =============================================
// 功能项修复
// =============================================
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
    
    // 合并但优先使用基础项目（覆盖原有的受限功能）
    const result = Object.assign({}, originalItems, baseItems);
    console.log("✅ 功能项修复完成");
    return result;
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
