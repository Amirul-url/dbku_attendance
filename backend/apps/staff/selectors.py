from .models import StaffMember


def staff_member_list(search=None, department=None):
    queryset = StaffMember.objects.select_related("user").all()
    if search:
        queryset = queryset.filter(full_name__icontains=search)
    if department:
        queryset = queryset.filter(department__icontains=department)
    return queryset


def staff_member_count():
    return StaffMember.objects.count()


def staff_member_by_staff_id(staff_id):
    return StaffMember.objects.filter(staff_id__iexact=staff_id).first()


def staff_member_by_phone_number(phone_number):
    return StaffMember.objects.select_related("user").filter(phone_number=phone_number).first()


def staff_member_exists_by_staff_id(staff_id):
    return StaffMember.objects.filter(staff_id__iexact=staff_id).exists()


def staff_member_exists_by_email(email):
    return StaffMember.objects.filter(email__iexact=email).exists()


def staff_member_exists_by_phone_number(phone_number):
    return StaffMember.objects.filter(phone_number=phone_number).exists()
