import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import api from '../../services/api';
import { processClassData } from '../../utils/dataProcessing';

const FixedSubjectClassAssignment = () => {
  const [subjects, setSubjects] = useState([]);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedClass, setSelectedClass] = useState(null);
  const [formData, setFormData] = useState({
    classId: '',
    subjectId: '',
    teacherId: ''
  });
  const [debugInfo, setDebugInfo] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      console.log('Fetching subjects, classes, and teachers...');
      const [subjectsRes, classesRes, teachersRes] = await Promise.all([
        api.get('/subjects'),
        api.get('/classes'),
        api.get('/teachers?status=active')
      ]);

      // Ensure we have valid data
      const validSubjects = Array.isArray(subjectsRes.data) ? subjectsRes.data : [];
      const validClasses = Array.isArray(classesRes.data) ? classesRes.data : [];
      const validTeachers = Array.isArray(teachersRes.data) ? teachersRes.data : [];

      console.log('Fetched subjects:', validSubjects.length);
      console.log('Fetched classes:', validClasses.length);
      console.log('Fetched teachers:', validTeachers.length);

      setSubjects(validSubjects);
      setClasses(validClasses);
      setTeachers(validTeachers);
      setError(''); // Clear any previous errors
    } catch (err) {
      console.error('Error fetching data:', err);
      let errorMessage = 'Failed to fetch data';
      if (err.response) {
        errorMessage = err.response.data?.message || err.response.statusText || errorMessage;
      } else if (err.request) {
        errorMessage = 'No response received from server. Please check your network connection.';
      } else {
        errorMessage = err.message || errorMessage;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassDetails = async (classId) => {
    if (!classId) {
      setSelectedClass(null);
      return;
    }

    setLoading(true);
    try {
      const response = await api.get(`/classes/${classId}`);
      console.log('Fetched class details:', response.data);

      // Process the class data to handle academicYear and other nested objects safely
      const processedClassData = processClassData(response.data);
      console.log('Processed class data:', processedClassData);

      setSelectedClass(processedClassData);
    } catch (err) {
      console.error('Error fetching class details:', err);
      setError('Failed to fetch class details');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSubject = async (classId, subjectId) => {
    if (!classId || !subjectId) {
      setError('Invalid class or subject ID');
      return;
    }

    if (window.confirm('Are you sure you want to remove this subject from the class?')) {
      setLoading(true);
      try {
        // Get current class data
        const classResponse = await api.get(`/classes/${classId}`);
        const classData = classResponse.data;

        // Filter out the subject to remove
        const updatedSubjects = (classData.subjects || []).filter(
          item => item.subject?._id !== subjectId && item.subject !== subjectId
        );

        console.log('Removing subject. Updated subjects array:', updatedSubjects);

        // Update the class with the new subjects array
        const updateResponse = await api.put(`/classes/${classId}/subjects`, {
          subjects: updatedSubjects
        });

        console.log('Subject removal response:', updateResponse.data);
        setSuccess('Subject removed from class successfully');

        // Refresh the selected class data
        fetchClassDetails(classId);
      } catch (err) {
        console.error('Error removing subject:', err);
        setError('Failed to remove subject from class');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.classId || !formData.subjectId) {
      setError('Please select both a class and a subject');
      return;
    }

    setLoading(true);
    setDebugInfo(null);
    try {
      // Get current class data
      const classResponse = await api.get(`/api/classes/${formData.classId}`);
      const classData = classResponse.data;

      // Check if this subject is already in the class
      const subjects = classData.subjects || [];
      let subjectExists = false;

      // Create a new subjects array to avoid reference issues
      const updatedSubjects = [...subjects];

      // Update or add the subject-teacher assignment
      for (let i = 0; i < updatedSubjects.length; i++) {
        const subjectId = updatedSubjects[i].subject?._id || updatedSubjects[i].subject;
        const formSubjectId = formData.subjectId;

        if (subjectId &&
            (subjectId === formSubjectId ||
             subjectId.toString() === formSubjectId.toString())) {
          // Update existing subject
          updatedSubjects[i] = {
            subject: formSubjectId,
            teacher: formData.teacherId || null
          };
          subjectExists = true;
          break;
        }
      }

      // If subject doesn't exist in this class, add it
      if (!subjectExists) {
        updatedSubjects.push({
          subject: formData.subjectId,
          teacher: formData.teacherId || null
        });
      }

      console.log('Submitting updated subjects:', updatedSubjects);

      // Store debug info
      setDebugInfo({
        originalSubjects: subjects,
        updatedSubjects: updatedSubjects,
        formData: { ...formData }
      });

      // Update the class with the new subjects array
      const updateResponse = await api.put(`/api/classes/${formData.classId}/subjects`, {
        subjects: updatedSubjects
      });

      console.log('Update response:', updateResponse.data);
      setSuccess('Subject assigned to class successfully');
      setOpenDialog(false);

      // Reset form data
      setFormData({
        classId: '',
        subjectId: '',
        teacherId: ''
      });

      // Refresh the selected class data if it's the same as the one we just updated
      if (selectedClass && selectedClass._id === formData.classId) {
        fetchClassDetails(formData.classId);
      }
    } catch (err) {
      console.error('Error assigning subject:', err);
      setError(`Failed to assign subject to class: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Safe render function for teacher names
  const renderTeacherName = (teacher) => {
    if (!teacher) return 'Not Assigned';
    const firstName = teacher.firstName || '';
    const lastName = teacher.lastName || '';
    return `${firstName} ${lastName}`.trim() || 'Unknown Teacher';
  };

  // Safe render function for subject names
  const renderSubjectName = (subject) => {
    if (!subject) return 'Unknown Subject';
    return subject.name || 'Unknown Subject';
  };

  // Safe render function for class names
  const renderClassName = (classItem) => {
    if (!classItem) return 'Unknown Class';
    return classItem.name || 'Unknown Class';
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Subject Class Assignment
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Select Class</InputLabel>
            <Select
              value={selectedClass?._id || ''}
              onChange={(e) => fetchClassDetails(e.target.value)}
              label="Select Class"
            >
              {classes.map((classItem) => (
                <MenuItem key={classItem._id} value={classItem._id}>
                  {renderClassName(classItem)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <Button
            variant="contained"
            onClick={() => setOpenDialog(true)}
            disabled={loading}
          >
            Assign Subject to Class
          </Button>
        </Grid>
      </Grid>

      {loading && !selectedClass && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {selectedClass && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Subjects in {renderClassName(selectedClass)}
          </Typography>

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Subject</TableCell>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!selectedClass.subjects || selectedClass.subjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} align="center">
                      No subjects assigned to this class
                    </TableCell>
                  </TableRow>
                ) : (
                  selectedClass.subjects.map((subjectItem, index) => {
                    // Get the subject details
                    const subjectId = subjectItem.subject?._id || subjectItem.subject;
                    const subject = subjects.find(s => s._id === subjectId);

                    // Get the teacher details
                    const teacherId = subjectItem.teacher?._id || subjectItem.teacher;
                    const teacher = teachers.find(t => t._id === teacherId);

                    return (
                      <TableRow key={subjectId ? subjectId : `subject-${index}`}>
                        <TableCell>{renderSubjectName(subject)}</TableCell>
                        <TableCell>{renderTeacherName(teacher)}</TableCell>
                        <TableCell>
                          <IconButton
                            color="error"
                            onClick={() => handleRemoveSubject(selectedClass._id, subjectId)}
                            disabled={loading}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {debugInfo && (
        <Box sx={{ mt: 4, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          <Typography variant="h6">Debug Information</Typography>
          <pre style={{ overflow: 'auto', maxHeight: '200px' }}>
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setDebugInfo(null)}
            sx={{ mt: 1 }}
          >
            Clear Debug Info
          </Button>
        </Box>
      )}

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
        <DialogTitle>Assign Subject to Class</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Class</InputLabel>
              <Select
                value={formData.classId}
                onChange={(e) => setFormData({...formData, classId: e.target.value})}
                label="Class"
              >
                {classes.map((classItem) => (
                  <MenuItem key={classItem._id} value={classItem._id}>
                    {renderClassName(classItem)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Subject</InputLabel>
              <Select
                value={formData.subjectId}
                onChange={(e) => setFormData({...formData, subjectId: e.target.value})}
                label="Subject"
              >
                {subjects.map((subject) => (
                  <MenuItem key={subject._id} value={subject._id}>
                    {renderSubjectName(subject)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Teacher (Optional)</InputLabel>
              <Select
                value={formData.teacherId || ''}
                onChange={(e) => setFormData({...formData, teacherId: e.target.value || null})}
                label="Teacher (Optional)"
              >
                <MenuItem value="">
                  <em>No Teacher Assigned</em>
                </MenuItem>
                {teachers.map((teacher) => (
                  <MenuItem key={teacher._id} value={teacher._id}>
                    {renderTeacherName(teacher)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disabled={loading}
          >
            {loading ? <CircularProgress size={20} /> : 'Assign'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FixedSubjectClassAssignment;
