use std::sync::RwLock;
use once_cell::sync::Lazy;
use jni::JNIEnv;
use jni::objects::{JClass, JString};
use jni::sys::{jboolean, JNI_TRUE, JNI_FALSE};
use adblock::engine::Engine;
use adblock::lists::{FilterSet, ParseOptions};
use adblock::request::Request;

static ENGINE: Lazy<RwLock<Option<Engine>>> = Lazy::new(|| RwLock::new(None));

#[no_mangle]
pub extern "system" fn Java_app_bujuu_tv_adblock_AdBlockBridge_nativeInit(
    mut env: JNIEnv,
    _class: JClass,
    rules: JString,
) -> jboolean {
    let rules_str: String = match env.get_string(&rules) {
        Ok(s) => s.into(),
        Err(_) => return JNI_FALSE,
    };

    let mut filter_set = FilterSet::new(true);
    filter_set.add_filter_list(rules_str, ParseOptions::default());
    let engine = Engine::new_with_filter_set(filter_set);

    if let Ok(mut lock) = ENGINE.write() {
        *lock = Some(engine);
        JNI_TRUE
    } else {
        JNI_FALSE
    }
}

#[no_mangle]
pub extern "system" fn Java_app_bujuu_tv_adblock_AdBlockBridge_nativeGetRulesStats(
    env: JNIEnv,
    _class: JClass,
) -> jni::sys::jstring {
    let lock = match ENGINE.read() {
        Ok(l) => l,
        Err(_) => return std::ptr::null_mut(),
    };

    if let Some(engine) = lock.as_ref() {
        let debug = engine.get_debug_info();
        let mut network_count = 0;
        let mut cosmetic_count = 0;
        let mut parse_errors = 0;
        for info in debug.source_info.iter() {
            network_count += info.network_filter_count;
            cosmetic_count += info.cosmetic_filter_count;
            parse_errors += info.parse_error;
        }

        let json = format!(
            "{{\"network_filters\":{},\"cosmetic_filters\":{},\"parse_errors\":{}}}",
            network_count, cosmetic_count, parse_errors
        );

        if let Ok(js) = env.new_string(json) {
            return js.into_raw();
        }
    }

    std::ptr::null_mut()
}

#[no_mangle]
pub extern "system" fn Java_app_bujuu_tv_adblock_AdBlockBridge_nativeShouldBlock(
    mut env: JNIEnv,
    _class: JClass,
    url: JString,
    source_url: JString,
    request_type: JString,
) -> jboolean {
    let url_str: String = match env.get_string(&url) {
        Ok(s) => s.into(),
        Err(_) => return JNI_FALSE,
    };

    let source_str: String = match env.get_string(&source_url) {
        Ok(s) => s.into(),
        Err(_) => String::new(),
    };

    let req_type_str: String = match env.get_string(&request_type) {
        Ok(s) => s.into(),
        Err(_) => "other".to_string(),
    };

    let lock = match ENGINE.read() {
        Ok(l) => l,
        Err(_) => return JNI_FALSE,
    };

    if let Some(engine) = lock.as_ref() {
        if let Ok(request) = Request::new(&url_str, &source_str, &req_type_str, "GET") {
            let result = engine.check_network_request(&request);
            if result.should_block() {
                return JNI_TRUE;
            }
        }
    }

    JNI_FALSE
}

#[no_mangle]
pub extern "system" fn Java_app_bujuu_tv_adblock_AdBlockBridge_nativeGetRedirect(
    mut env: JNIEnv,
    _class: JClass,
    url: JString,
    source_url: JString,
    request_type: JString,
) -> jni::sys::jstring {
    let url_str: String = match env.get_string(&url) {
        Ok(s) => s.into(),
        Err(_) => return std::ptr::null_mut(),
    };

    let source_str: String = match env.get_string(&source_url) {
        Ok(s) => s.into(),
        Err(_) => String::new(),
    };

    let req_type_str: String = match env.get_string(&request_type) {
        Ok(s) => s.into(),
        Err(_) => "other".to_string(),
    };

    let lock = match ENGINE.read() {
        Ok(l) => l,
        Err(_) => return std::ptr::null_mut(),
    };

    if let Some(engine) = lock.as_ref() {
        if let Ok(request) = Request::new(&url_str, &source_str, &req_type_str, "GET") {
            let result = engine.check_network_request(&request);
            if let Some(redirect) = result.redirect {
                if let Ok(js) = env.new_string(redirect) {
                    return js.into_raw();
                }
            }
        }
    }

    std::ptr::null_mut()
}

#[no_mangle]
pub extern "system" fn Java_app_bujuu_tv_adblock_AdBlockBridge_nativeGetCosmeticSelectors(
    mut env: JNIEnv,
    _class: JClass,
    url: JString,
) -> jni::sys::jstring {
    let url_str: String = match env.get_string(&url) {
        Ok(s) => s.into(),
        Err(_) => return std::ptr::null_mut(),
    };

    let lock = match ENGINE.read() {
        Ok(l) => l,
        Err(_) => return std::ptr::null_mut(),
    };

    if let Some(engine) = lock.as_ref() {
        let resources = engine.url_cosmetic_resources(&url_str);
        if !resources.hide_selectors.is_empty() {
            let combined: Vec<String> = resources.hide_selectors.into_iter().collect();
            let json = format!("{{\"selectors\":[{}]}}", combined.iter().map(|s| format!("\"{}\"", s.replace('\"', "\\\""))).collect::<Vec<_>>().join(","));
            if let Ok(js) = env.new_string(json) {
                return js.into_raw();
            }
        }
    }

    std::ptr::null_mut()
}

#[no_mangle]
pub extern "system" fn Java_app_bujuu_tv_adblock_AdBlockBridge_nativeGetScriptlet(
    mut env: JNIEnv,
    _class: JClass,
    url: JString,
) -> jni::sys::jstring {
    let url_str: String = match env.get_string(&url) {
        Ok(s) => s.into(),
        Err(_) => return std::ptr::null_mut(),
    };

    let lock = match ENGINE.read() {
        Ok(l) => l,
        Err(_) => return std::ptr::null_mut(),
    };

    if let Some(engine) = lock.as_ref() {
        let resources = engine.url_cosmetic_resources(&url_str);
        if !resources.injected_script.is_empty() {
            if let Ok(js) = env.new_string(resources.injected_script) {
                return js.into_raw();
            }
        }
    }

    std::ptr::null_mut()
}
