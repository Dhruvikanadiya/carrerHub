import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Collapse,
  Divider,
  Form,
  Input,
  Progress,
  Radio,
  Select,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  Upload,
  App
} from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileDoneOutlined,
  FileSearchOutlined,
  InboxOutlined,
  RetweetOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import api, { downloadBlob, getErrorMessage } from '../services/api';

function ListBlock({ title, items }) {
  if (!items?.length) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <Typography.Title level={5}>{title}</Typography.Title>
      <ul>
        {items.map((item, i) => (
          <li key={`${title}-${i}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function AiTailor() {
  const [form] = Form.useForm();
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('multi'); // 'multi' or 'legacy'
  const { message } = App.useApp();

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get('/resumes');
        setResumes(data.resumes);
      } catch (err) {
        message.error(getErrorMessage(err, 'Could not load resume library'));
      }
    })();
  }, [message]);

  const tailor = async (values) => {
    const formData = new FormData();
    if (values.jobDescription) formData.append('jobDescription', values.jobDescription);
    if (values.resumeId) formData.append('resumeId', values.resumeId);
    const jdFile = values.jdFile?.[0]?.originFileObj;
    const resumeFile = values.resumeFile?.[0]?.originFileObj;
    if (jdFile) formData.append('jdFile', jdFile);
    if (resumeFile) formData.append('resume', resumeFile);

    setLoading(true);
    setResult(null);

    const endpoint = mode === 'multi' ? '/ai/multi-agent-tailor' : '/ai/tailor';

    try {
      const { data } = await api.post(endpoint, formData);
      setResult(data);
      if (mode === 'multi') {
        const score = data.multiAgent?.matchScore || 0;
        message.success(`Multi-agent tailoring finished! Match score: ${score}%`);
      } else {
        message.success('Tailored resume ready');
      }
    } catch (err) {
      message.error(getErrorMessage(err, 'AI tailoring failed'));
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    if (!result?.tailoredResume) return;
    try {
      const name = result.tailoredResume.name || 'tailored-resume';
      await downloadBlob('/ai/download', `${name}.pdf`, { tailoredResume: result.tailoredResume });
      message.success('PDF downloaded');
    } catch (err) {
      message.error(getErrorMessage(err, 'Could not generate PDF'));
    }
  };

  const r = result?.tailoredResume;
  const exp = result?.explanation;
  const ma = result?.multiAgent;

  return (
    <div>
      <div className="agent-banner">
        <div>
          <div className="agent-banner-title">
            <RobotOutlined style={{ fontSize: 20 }} /> CareerHub AI Resume Tailor
          </div>
          <p style={{ margin: '4px 0 0', opacity: 0.85, fontSize: 13 }}>
            Powered by Gemini with truth guardrails to ensure honest, fact-backed resumes.
          </p>
        </div>
        <Radio.Group
          value={mode}
          onChange={(e) => setMode(e.target.value)}
          buttonStyle="solid"
          size="middle"
        >
          <Radio.Button value="multi">
            <ThunderboltOutlined /> 5-Agent System (Recommended)
          </Radio.Button>
          <Radio.Button value="legacy">Standard Mode</Radio.Button>
        </Radio.Group>
      </div>

      <Alert
        style={{ marginBottom: 16 }}
        type="info"
        showIcon
        message={
          mode === 'multi'
            ? '5-Agent Pipeline Active (Parallel Extraction, Gap Analysis & Reviewer Guard)'
            : 'Standard Mode Active (Single Prompt)'
        }
        description={
          mode === 'multi'
            ? 'Runs 5 specialized agents: JD Analyzer & Resume Parser run concurrently, followed by Gap Analysis, Fact-Based Rewriter, and the Reviewer Audit loop with up to 2 retries.'
            : 'Legacy mode: Single prompt rewrites and reorders existing resume content without inventing new experience.'
        }
      />

      <div className="ai-grid">
        <Card
          title={
            <Space>
              <FileSearchOutlined />
              <span>Inputs & Options</span>
            </Space>
          }
        >
          <Form form={form} layout="vertical" onFinish={tailor}>
            <Form.Item name="jobDescription" label="Paste job description">
              <Input.TextArea rows={8} placeholder="Paste the full job description here…" />
            </Form.Item>
            <Form.Item
              name="jdFile"
              label="Or upload JD (PDF or TXT)"
              valuePropName="fileList"
              getValueFromEvent={(e) => e?.fileList}
            >
              <Upload accept=".pdf,.txt,application/pdf,text/plain" maxCount={1} beforeUpload={() => false}>
                <Button icon={<InboxOutlined />}>Choose JD file</Button>
              </Upload>
            </Form.Item>
            <Form.Item name="resumeId" label="Resume from library">
              <Select
                allowClear
                placeholder="Select an uploaded resume"
                options={resumes.map((item) => ({
                  value: item._id,
                  label: `${item.name} (${item.version})`
                }))}
              />
            </Form.Item>
            <Form.Item
              name="resumeFile"
              label="Or upload a resume PDF instead"
              valuePropName="fileList"
              getValueFromEvent={(e) => e?.fileList}
            >
              <Upload accept="application/pdf" maxCount={1} beforeUpload={() => false}>
                <Button icon={<InboxOutlined />}>Choose resume PDF</Button>
              </Upload>
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">
              {mode === 'multi' ? 'Run 5-Agent Tailoring Pipeline' : 'Tailor resume'}
            </Button>
          </Form>
        </Card>

        <Card
          title="Result"
          extra={
            result ? (
              <Button type="primary" onClick={download} icon={<FileDoneOutlined />}>
                Download PDF
              </Button>
            ) : null
          }
        >
          {loading ? (
            <div className="agent-loading-box">
              <Spin size="large" />
              <Typography.Title level={4} style={{ marginTop: 16 }}>
                {mode === 'multi'
                  ? 'Orchestrating 5 AI Agents…'
                  : 'Reading JD and tailoring resume…'}
              </Typography.Title>
              <p className="muted" style={{ maxWidth: 440, margin: '0 auto 16px' }}>
                {mode === 'multi'
                  ? 'Analyzing job requirements, parsing resume sections, computing ATS match score, and auditing for factual accuracy.'
                  : 'Processing your resume and job description with Gemini.'}
              </p>

              {mode === 'multi' && (
                <div className="agent-pipeline-steps">
                  <div className="agent-step-item">
                    <ThunderboltOutlined style={{ color: '#1a4d8c' }} />
                    <span>Agent 1 & 2: JD Analyzer & Resume Parser (Parallel)</span>
                  </div>
                  <div className="agent-step-item">
                    <FileSearchOutlined style={{ color: '#0f766e' }} />
                    <span>Agent 3: Gap Analyzer & ATS Match Scoring</span>
                  </div>
                  <div className="agent-step-item">
                    <RetweetOutlined style={{ color: '#1677ff' }} />
                    <span>Agent 4: Resume Rewriter (Fact-Preserved Tailoring)</span>
                  </div>
                  <div className="agent-step-item">
                    <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
                    <span>Agent 5: Reviewer Audit (Truth & Anti-Hallucination Guard)</span>
                  </div>
                </div>
              )}
            </div>
          ) : !result ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <RobotOutlined style={{ fontSize: 36, color: '#94a3b8', marginBottom: 12 }} />
              <p className="muted">
                Run the tailor to generate an optimized resume, match score, and factual audit report.
              </p>
            </div>
          ) : (
            <div>
              {/* Multi-Agent Specific Header Metrics */}
              {ma && (
                <>
                  <div className="agent-stats-grid">
                    <div className="agent-stat-card">
                      <div className="agent-stat-value" style={{ color: ma.matchScore >= 75 ? '#52c41a' : '#faad14' }}>
                        {ma.matchScore}%
                      </div>
                      <div className="agent-stat-label">ATS Match Score</div>
                      <Progress
                        percent={ma.matchScore}
                        showInfo={false}
                        strokeColor={ma.matchScore >= 75 ? '#52c41a' : '#faad14'}
                        size="small"
                      />
                    </div>

                    <div className="agent-stat-card">
                      <div className="agent-stat-value">
                        {ma.reviewerStatus === 'Approved' ? (
                          <Tag color="success" icon={<CheckCircleOutlined />} style={{ fontSize: 13, padding: '4px 8px' }}>
                            Approved
                          </Tag>
                        ) : (
                          <Tag color="warning" icon={<ExclamationCircleOutlined />} style={{ fontSize: 13, padding: '4px 8px' }}>
                            {ma.reviewerStatus}
                          </Tag>
                        )}
                      </div>
                      <div className="agent-stat-label">Reviewer Guard</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        {ma.retryCount === 0 ? 'Passed 1st check' : `${ma.retryCount} auto-correction`}
                      </div>
                    </div>

                    <div className="agent-stat-card">
                      <div className="agent-stat-value" style={{ fontSize: 18 }}>
                        {ma.matchedSkills?.length || 0} / {(ma.matchedSkills?.length || 0) + (ma.missingSkills?.length || 0)}
                      </div>
                      <div className="agent-stat-label">Skills Covered</div>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                        {ma.missingSkills?.length || 0} gaps noted
                      </div>
                    </div>
                  </div>

                  {ma.reviewerFeedback && (
                    <Alert
                      style={{ marginBottom: 16 }}
                      type={ma.reviewerStatus === 'Approved' ? 'success' : 'warning'}
                      showIcon
                      icon={<SafetyCertificateOutlined />}
                      message="Reviewer Audit Report"
                      description={ma.reviewerFeedback}
                    />
                  )}

                  {/* Skills Breakdown */}
                  <div style={{ marginBottom: 16 }}>
                    <Typography.Title level={5}>Matched Skills in JD</Typography.Title>
                    <Space wrap style={{ marginBottom: 12 }}>
                      {ma.matchedSkills?.length ? (
                        ma.matchedSkills.map((s, idx) => (
                          <Tag color="green" key={`match-${idx}`}>
                            ✓ {s}
                          </Tag>
                        ))
                      ) : (
                        <span className="muted">No direct skills matched</span>
                      )}
                    </Space>

                    {ma.missingSkills?.length ? (
                      <>
                        <Typography.Title level={5} style={{ marginTop: 8 }}>
                          Missing JD Requirements (Not Added to Preserve Integrity)
                        </Typography.Title>
                        <Space wrap>
                          {ma.missingSkills.map((s, idx) => (
                            <Tag color="volcano" key={`miss-${idx}`}>
                              ✕ {s}
                            </Tag>
                          ))}
                        </Space>
                      </>
                    ) : null}
                  </div>

                  <Divider />
                </>
              )}

              {/* Standard Tailored Resume Preview */}
              <Typography.Title level={4}>{r.name || 'Tailored resume'}</Typography.Title>
              {r.contact ? <p className="muted">{r.contact}</p> : null}
              {r.summary ? (
                <>
                  <Typography.Title level={5}>Professional Summary</Typography.Title>
                  <p>{r.summary}</p>
                </>
              ) : null}
              {r.skills?.length ? (
                <>
                  <Typography.Title level={5}>Skills</Typography.Title>
                  <p>{r.skills.join(' · ')}</p>
                </>
              ) : null}
              {r.experience?.length ? (
                <>
                  <Typography.Title level={5}>Experience</Typography.Title>
                  {r.experience.map((item, i) => (
                    <div key={`exp-${i}`} style={{ marginBottom: 12 }}>
                      <strong>{item.title}</strong>
                      <div className="muted">
                        {[item.company, item.dates].filter(Boolean).join(' | ')}
                      </div>
                      <ul>
                        {(item.bullets || []).map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : null}
              {r.projects?.length ? (
                <>
                  <Typography.Title level={5}>Projects</Typography.Title>
                  {r.projects.map((item, i) => (
                    <div key={`proj-${i}`} style={{ marginBottom: 12 }}>
                      <strong>{item.name}</strong>
                      {item.description ? <p>{item.description}</p> : null}
                      <ul>
                        {(item.bullets || []).map((b, j) => (
                          <li key={j}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </>
              ) : null}
              {r.education?.length ? (
                <>
                  <Typography.Title level={5}>Education</Typography.Title>
                  {r.education.map((item, i) => (
                    <p key={`ed-${i}`}>
                      <strong>{item.degree}</strong>
                      <br />
                      {[item.school, item.dates].filter(Boolean).join(' | ')}
                      {item.details ? (
                        <>
                          <br />
                          {item.details}
                        </>
                      ) : null}
                    </p>
                  ))}
                </>
              ) : null}
              {r.certifications?.length ? (
                <ListBlock title="Certifications" items={r.certifications} />
              ) : null}
              {r.other ? (
                <>
                  <Typography.Title level={5}>Additional</Typography.Title>
                  <p>{r.other}</p>
                </>
              ) : null}

              <Typography.Title level={4} style={{ marginTop: 24 }}>
                What changed
              </Typography.Title>
              <ListBlock title="Changes" items={exp?.changes} />
              <ListBlock title="Why" items={exp?.why} />
              <ListBlock title="JD requirements that influenced this" items={exp?.jdInfluences} />
              <ListBlock title="Existing content prioritized" items={exp?.prioritized} />
              <ListBlock title="Important JD gaps" items={exp?.missingFromResume} />

              {/* Performance Metrics Footer */}
              {ma?.timeTakenMs && (
                <Collapse
                  ghost
                  style={{ marginTop: 16 }}
                  items={[
                    {
                      key: 'metrics',
                      label: (
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          ⚡ Multi-Agent Performance Telemetry ({Math.round(ma.timeTakenMs.total / 1000)}s total)
                        </span>
                      ),
                      children: (
                        <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.8 }}>
                          <div>• Parallel Extraction: JD ({ma.timeTakenMs.jdAnalyzer}ms) & Resume ({ma.timeTakenMs.resumeParser}ms)</div>
                          <div>• Gap Analysis: {ma.timeTakenMs.gapAnalyzer}ms</div>
                          <div>• Resume Rewriter: {ma.timeTakenMs.resumeRewriter}ms</div>
                          <div>• Reviewer Audit: {ma.timeTakenMs.reviewer}ms</div>
                          {ma.tokensUsed?.totalTokens ? (
                            <div>• Total Tokens Processed: {ma.tokensUsed.totalTokens.toLocaleString()}</div>
                          ) : null}
                          {ma.agentRunId && (
                            <div>• AgentRun MongoDB ID: <code style={{ fontSize: 11 }}>{ma.agentRunId}</code></div>
                          )}
                        </div>
                      )
                    }
                  ]}
                />
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
