using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class BallController : MonoBehaviour
{
    private Rigidbody2D ball_rb;
    private GameObject gManager;
    public GameObject celebration_effect;

    // Start is called before the first frame update
    void Start()
    {
        ball_rb = gameObject.GetComponent<Rigidbody2D>();
        gManager = GameObject.Find("GameManager");
    }

    // Update is called once per frame
    void Update()
    {
        
    }

    private void OnTriggerEnter2D(Collider2D collision)
    {
        Debug.Log("Entered Trigger");
        if (collision.CompareTag("Goal1") || collision.CompareTag("Goal2"))
        {
            Debug.Log("GOAL!");

            GameObject celebrate_obj = Instantiate(celebration_effect, transform.position, new Quaternion(-90f, 0, 0, 0));
            celebration_effect.GetComponent<ParticleSystem>().Play();
            Destroy(celebrate_obj, celebration_effect.GetComponent<ParticleSystem>().main.duration);
            Destroy(gameObject);
            gManager.GetComponent<GameManager>().EndGame();
        }
    }
}
