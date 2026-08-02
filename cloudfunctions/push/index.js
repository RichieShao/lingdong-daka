// 云函数 push —— 写入/覆盖用户云端数据（以 uid 为文档主键，LWW 由 updatedAt 控制）
// 契约：前端 callFunction({ name:'push', data:{ uid, data, updatedAt } }) → { ok }
const cloudbase = require('@cloudbase/node-sdk');
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();

// 取调用方真实身份（CloudBase 匿名/自定义登录用户），用于越权防护
async function callerUid() {
  try {
    const info = await app.auth().getEndUserInfo();
    return (info && info.userInfo && info.userInfo.uid) || '';
  } catch (e) {
    return '';
  }
}

exports.main = async (event) => {
  let uid = (event && event.uid) || '';
  const data = event && event.data;
  const updatedAt = (event && event.updatedAt) || Date.now();
  const real = await callerUid();
  if (real) {
    // 调用方身份优先；若前端传了 uid 且与调用方不一致，视为越权
    if (uid && uid !== real) return { ok: false, err: 'forbidden' };
    uid = real;
  }
  if (!uid || !data) return { ok: false, err: 'bad_params' };
  try {
    await db.collection('sync').doc(uid).set({
      data: { data: data, updatedAt: updatedAt },
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e) };
  }
};
