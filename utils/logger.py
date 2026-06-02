from loguru import logger
import sys
import io

def setup_logger():
    # Force UTF-8 sur la console Windows (évite UnicodeEncodeError avec les emojis/box-drawing)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    else:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

    logger.remove()
    logger.add(
        sys.stdout,
        format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{message}</cyan>",
        level="INFO"
    )
    logger.add(
        "logs/vinted_bot.log",
        rotation="5 MB",
        retention="7 days",
        level="DEBUG",
        encoding="utf-8"
    )
    return logger
