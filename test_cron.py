import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from backend.services.reminders import check_overdue_books

try:
    check_overdue_books()
    print("Success")
except Exception as e:
    import traceback
    traceback.print_exc()
