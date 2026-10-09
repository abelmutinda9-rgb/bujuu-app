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

    let mut filter_set = FilterSet::new(false);
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
