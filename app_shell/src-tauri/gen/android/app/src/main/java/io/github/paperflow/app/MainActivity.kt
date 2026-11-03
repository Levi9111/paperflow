package io.github.paperflow.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import androidx.activity.enableEdgeToEdge
import androidx.core.content.FileProvider
import java.io.File
import java.io.FileOutputStream

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    instance = this
  }

  override fun onDestroy() {
    if (instance == this) {
      instance = null
    }
    super.onDestroy()
  }

  companion object {
    var instance: MainActivity? = null

    @JvmStatic
    fun resolveContentUri(uriStr: String): String? {
      val act = instance ?: return null
      return try {
        if (!uriStr.startsWith("content://")) {
          return uriStr
        }
        val uri = Uri.parse(uriStr)
        var displayName: String? = null
        val cursor = act.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)
        cursor?.use {
          if (it.moveToFirst()) {
            val idx = it.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (idx >= 0) displayName = it.getString(idx)
          }
        }
        val fileName = displayName ?: "doc_${System.currentTimeMillis()}.pdf"
        val cacheDir = File(act.cacheDir, "imported")
        if (!cacheDir.exists()) cacheDir.mkdirs()
        val destFile = File(cacheDir, fileName)
        act.contentResolver.openInputStream(uri)?.use { input ->
          FileOutputStream(destFile).use { output ->
            input.copyTo(output)
          }
        }
        destFile.absolutePath
      } catch (e: Exception) {
        e.printStackTrace()
        null
      }
    }

    @JvmStatic
    fun shareFile(filePath: String): Boolean {
      val act = instance ?: return false
      return try {
        val file = File(filePath)
        if (!file.exists()) return false
        val uri = FileProvider.getUriForFile(
          act,
          "${act.packageName}.fileprovider",
          file
        )
        val mimeType = when {
          filePath.endsWith(".pdf", ignoreCase = true) -> "application/pdf"
          filePath.endsWith(".png", ignoreCase = true) -> "image/png"
          filePath.endsWith(".jpg", ignoreCase = true) || filePath.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
          filePath.endsWith(".webp", ignoreCase = true) -> "image/webp"
          else -> "*/*"
        }
        val intent = Intent(Intent.ACTION_SEND).apply {
          type = mimeType
          putExtra(Intent.EXTRA_STREAM, uri)
          addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(intent, "Share via PaperFlow")
        chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        act.startActivity(chooser)
        true
      } catch (e: Exception) {
        e.printStackTrace()
        false
      }
    }
  }
}
