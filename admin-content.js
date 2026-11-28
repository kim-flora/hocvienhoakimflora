const partSize = 3000000;

export async function readAdminContent(client, key) {
  async function readPart(offset, version) {
    const { data, error } = await client.rpc("kf_read_admin_content_part", {
      p_key: key,
      p_offset: offset,
      p_version: version,
    }).abortSignal(AbortSignal.timeout(60000));
    if (error) throw new Error("Máy chủ chưa gửi được tài liệu quản trị.", { cause: error });
    return data;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    const first = await readPart(0, null);
    if (!first?.version || !Number.isSafeInteger(first.length) || typeof first.part !== "string") {
      throw new Error("Phiên hiện tại không tải được tài liệu quản trị.");
    }

    const parts = [first.part];
    let versionChanged = false;
    for (let offset = partSize; offset < first.length && !versionChanged; offset += partSize * 3) {
      const offsets = [offset, offset + partSize, offset + partSize * 2].filter(start => start < first.length);
      const batch = await Promise.all(offsets.map(start => readPart(start, first.version)));
      versionChanged = batch.some(part => part?.version !== first.version || typeof part.part !== "string");
      if (!versionChanged) parts.push(...batch.map(part => part.part));
    }
    if (!versionChanged) return JSON.parse(parts.join(""));
  }

  throw new Error("Tài liệu vừa được cập nhật. Hãy thử tải lại.");
}
